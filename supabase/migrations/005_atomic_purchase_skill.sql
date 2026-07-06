-- 005_atomic_purchase_skill.sql
-- Atomic skill purchase. Replaces the previous multi-statement JS logic (MCP tool
-- + REST route) that suffered a double-spend (unchecked zero-row optimistic lock),
-- lost-update races on total_earned / total_acquisitions, and JS float money math.
-- Everything now runs in one transaction with row locking and exact numeric math.
-- Tracks GitHub issues #16 (atomicity) and #17 (money precision).

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

  -- Undeliverable skill: neither a live endpoint nor a documented prompt.
  if v_skill.api_endpoint is null and v_skill.documentation is null then
    return jsonb_build_object('ok', false, 'code', 'skill_unavailable',
      'message', 'This skill has no endpoint or documentation configured yet and cannot be purchased');
  end if;

  -- Lock buyer (and seller) profile rows in a canonical order to avoid deadlocks.
  perform 1 from public.profiles
   where id in (p_buyer, v_skill.seller_id)
   order by id for update;

  select credits_gbp into v_balance from public.profiles where id = p_buyer;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'profile_error',
      'message', 'Could not retrieve wallet balance');
  end if;

  -- Already owned? Checked inside the same locked tx: no TOCTOU.
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

  -- Seller's commission rate drives the platform fee (matches prior app logic; default 25).
  select coalesce(commission_rate, 25) into v_commission
    from public.profiles where id = v_skill.seller_id;
  v_commission := coalesce(v_commission, 25);
  v_fee    := round(v_price * v_commission / 100, 2);   -- exact numeric, to pence
  v_payout := v_price - v_fee;

  update public.profiles set credits_gbp = credits_gbp - v_price where id = p_buyer;

  insert into public.acquisitions
    (buyer_id, skill_id, pricing_model, amount_paid, currency, payment_method, status)
  values (p_buyer, p_skill, v_skill.pricing_model, v_price, 'gbp', 'credits', 'active')
  returning id into v_acq_id;

  -- Credits sit in the seller's balance until a payout runs, so this is 'pending'
  -- (constraint allows pending|paid_out|refunded|disputed — 'completed' was invalid
  -- and the old un-checked insert had been failing silently).
  insert into public.transactions
    (acquisition_id, seller_id, skill_id, gross_amount, platform_fee, seller_payout,
     commission_rate, currency, payment_provider, provider_transaction_id, status)
  values (v_acq_id, v_skill.seller_id, p_skill, v_price, v_fee, v_payout,
          v_commission, 'gbp', 'credits', v_acq_id::text, 'pending');

  update public.profiles set total_earned = total_earned + v_payout where id = v_skill.seller_id;
  update public.skills   set total_acquisitions = coalesce(total_acquisitions, 0) + 1 where id = p_skill;

  return jsonb_build_object(
    'ok', true,
    'acquisition_id', v_acq_id,
    'skill_id', p_skill,
    'skill_name', v_skill.name,
    'amount_charged_gbp', v_price,
    'platform_fee_gbp', v_fee,
    'credits_remaining_gbp', v_balance - v_price,
    'access_endpoint', v_skill.api_endpoint
  );
end;
$$;

revoke all on function public.purchase_skill(uuid, uuid) from public;
grant execute on function public.purchase_skill(uuid, uuid) to authenticated, service_role;
