-- 009_skill_escrow.sql
-- Escrow on skill purchases (#18). Owner spec:
--   * On purchase, funds are HELD — the seller's total_earned is NOT credited yet.
--   * Buyer signs off (POST /api/v1/acquisitions/{id}/confirm) -> funds release (minus fee).
--   * Buyer does nothing -> auto-release after 7 days (cron sweep).
--   * Buyer disputes -> funds stay held until admin releases or refunds.
-- States: held -> released (sign-off / timeout / admin)
--         held -> disputed -> released | refunded (admin decides)
-- Historical acquisitions predate escrow and were already settled: default 'released'.

alter table public.acquisitions
  add column if not exists escrow_status text not null default 'released'
    check (escrow_status in ('held', 'released', 'disputed', 'refunded')),
  add column if not exists auto_release_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists disputed_at timestamptz,
  add column if not exists dispute_reason text;

-- The cron sweep scans for due holds.
create index if not exists acquisitions_escrow_due_idx
  on public.acquisitions (auto_release_at)
  where escrow_status = 'held';

-- ---------------------------------------------------------------------------
-- purchase_skill: same locked, exact-numeric flow as migration 005, EXCEPT the
-- seller payout is no longer credited at purchase time — the money sits in
-- escrow on the acquisition until release.
-- ---------------------------------------------------------------------------
create or replace function public.purchase_skill(p_buyer uuid, p_skill uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_skill      record;
  v_balance    numeric(10,2);
  v_price      numeric(10,2);
  v_commission numeric(5,2);
  v_fee        numeric(10,2);
  v_payout     numeric(10,2);
  v_acq_id     uuid;
  v_release_at timestamptz;
begin
  -- Lock the skill row first (stable lock order: skill -> profiles).
  select * into v_skill from public.skills where id = p_skill and is_active = true for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'skill_not_found',
      'message', format('Skill with ID "%s" not found or is inactive', p_skill));
  end if;

  if v_skill.seller_id = p_buyer then
    return jsonb_build_object('ok', false, 'code', 'self_purchase',
      'message', 'You cannot purchase your own skill');
  end if;

  if v_skill.api_endpoint is null and v_skill.documentation is null then
    return jsonb_build_object('ok', false, 'code', 'skill_unavailable',
      'message', 'This skill has no endpoint or documentation configured yet and cannot be purchased');
  end if;

  perform 1 from public.profiles
   where id in (p_buyer, v_skill.seller_id)
   order by id for update;

  select credits_gbp into v_balance from public.profiles where id = p_buyer;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'profile_error',
      'message', 'Could not retrieve wallet balance');
  end if;

  if exists (select 1 from public.acquisitions
             where buyer_id = p_buyer and skill_id = p_skill and status = 'active') then
    return jsonb_build_object('ok', false, 'code', 'already_owned',
      'message', 'You already own this skill', 'skill_id', p_skill);
  end if;

  v_price := coalesce(v_skill.price_gbp, 0);
  if v_balance < v_price then
    return jsonb_build_object('ok', false, 'code', 'insufficient_funds',
      'message', format('Insufficient credits. Balance: £%s, Required: £%s',
        to_char(v_balance, 'FM999999990.00'), to_char(v_price, 'FM999999990.00')),
      'balance_gbp', v_balance, 'required_gbp', v_price);
  end if;

  select coalesce(commission_rate, 25) into v_commission
    from public.profiles where id = v_skill.seller_id;
  v_commission := coalesce(v_commission, 25);
  v_fee    := round(v_price * v_commission / 100, 2);
  v_payout := v_price - v_fee;
  v_release_at := now() + interval '7 days';

  update public.profiles set credits_gbp = credits_gbp - v_price where id = p_buyer;

  -- ESCROW (#18): held, auto-releases in 7 days. Seller is NOT credited here.
  insert into public.acquisitions
    (buyer_id, skill_id, pricing_model, amount_paid, currency, payment_method, status,
     escrow_status, auto_release_at)
  values (p_buyer, p_skill, v_skill.pricing_model, v_price, 'gbp', 'credits', 'active',
     'held', v_release_at)
  returning id into v_acq_id;

  -- Settlement record. seller_payout here is the single source of truth the
  -- release function credits later. Stays 'pending' until payout; 'refunded' on refund.
  insert into public.transactions
    (acquisition_id, seller_id, skill_id, gross_amount, platform_fee, seller_payout,
     commission_rate, currency, payment_provider, provider_transaction_id, status)
  values (v_acq_id, v_skill.seller_id, p_skill, v_price, v_fee, v_payout,
          v_commission, 'gbp', 'credits', v_acq_id::text, 'pending');

  update public.skills set total_acquisitions = coalesce(total_acquisitions, 0) + 1 where id = p_skill;

  return jsonb_build_object(
    'ok', true,
    'acquisition_id', v_acq_id,
    'skill_id', p_skill,
    'skill_name', v_skill.name,
    'amount_charged_gbp', v_price,
    'platform_fee_gbp', v_fee,
    'credits_remaining_gbp', v_balance - v_price,
    'access_endpoint', v_skill.api_endpoint,
    'escrow_status', 'held',
    'auto_release_at', v_release_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- release_skill_escrow: credit the seller and close the hold.
--   p_allow_disputed  buyer-confirm/admin may release a disputed hold
--                     (buyer confirming = withdrawing their dispute).
--   p_require_due     cron sweep sets true so it can only release holds whose
--                     auto_release_at has passed — checked under the row lock,
--                     so a dispute that lands first always wins the race.
-- ---------------------------------------------------------------------------
create or replace function public.release_skill_escrow(
  p_acquisition uuid,
  p_allow_disputed boolean default false,
  p_require_due boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acq record;
  v_tx  record;
begin
  select * into v_acq from public.acquisitions where id = p_acquisition for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Acquisition not found');
  end if;

  if v_acq.escrow_status not in ('held', 'disputed')
     or (v_acq.escrow_status = 'disputed' and not p_allow_disputed) then
    return jsonb_build_object('ok', false, 'code', 'not_held',
      'message', format('Escrow is %s, cannot release', v_acq.escrow_status));
  end if;

  if p_require_due and (v_acq.auto_release_at is null or v_acq.auto_release_at > now()) then
    return jsonb_build_object('ok', false, 'code', 'not_due',
      'message', 'Escrow is not past its auto-release time');
  end if;

  select seller_id, seller_payout into v_tx
    from public.transactions where acquisition_id = p_acquisition
    order by created_at asc limit 1;
  if not found or v_tx.seller_id is null then
    return jsonb_build_object('ok', false, 'code', 'no_settlement',
      'message', 'No settlement record for this acquisition');
  end if;

  update public.profiles
     set total_earned = total_earned + coalesce(v_tx.seller_payout, 0)
   where id = v_tx.seller_id;

  update public.acquisitions
     set escrow_status = 'released', released_at = now()
   where id = p_acquisition;

  return jsonb_build_object('ok', true, 'acquisition_id', p_acquisition,
    'escrow_status', 'released', 'seller_payout_gbp', v_tx.seller_payout);
end;
$$;

-- ---------------------------------------------------------------------------
-- refund_skill_escrow: return the full price to the buyer, revoke access.
-- Admin dispute-resolution path only (funds must be held or disputed).
-- ---------------------------------------------------------------------------
create or replace function public.refund_skill_escrow(p_acquisition uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_acq record;
begin
  select * into v_acq from public.acquisitions where id = p_acquisition for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'Acquisition not found');
  end if;

  if v_acq.escrow_status not in ('held', 'disputed') then
    return jsonb_build_object('ok', false, 'code', 'not_held',
      'message', format('Escrow is %s, cannot refund', v_acq.escrow_status));
  end if;

  -- Full refund including the platform fee; seller was never credited.
  update public.profiles
     set credits_gbp = credits_gbp + coalesce(v_acq.amount_paid, 0)
   where id = v_acq.buyer_id;

  update public.acquisitions
     set escrow_status = 'refunded', status = 'refunded'
   where id = p_acquisition;

  update public.transactions
     set status = 'refunded'
   where acquisition_id = p_acquisition;

  return jsonb_build_object('ok', true, 'acquisition_id', p_acquisition,
    'escrow_status', 'refunded', 'refunded_gbp', v_acq.amount_paid);
end;
$$;

-- All three run with definer rights and take caller-supplied identities/ids,
-- so they are service_role only (the 007 lesson — anon/authenticated could
-- otherwise call them via /rest/v1/rpc).
revoke all on function public.purchase_skill(uuid, uuid) from public, anon, authenticated;
grant execute on function public.purchase_skill(uuid, uuid) to service_role;

revoke all on function public.release_skill_escrow(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.release_skill_escrow(uuid, boolean, boolean) to service_role;

revoke all on function public.refund_skill_escrow(uuid) from public, anon, authenticated;
grant execute on function public.refund_skill_escrow(uuid) to service_role;
