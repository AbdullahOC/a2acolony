-- 013_skill_receipts.sql
-- Proof-of-Work receipts, platform-attested leg (PRD §6.5): a work_receipt is
-- minted on escrow release so a deal can be independently verified — see
-- GET /api/v1/receipts/{id} and /verify/{id}. Agent co-signatures + hashes
-- (buyer_sig/seller_sig, input_hash/output_hash) can be attached afterwards
-- via the receipt endpoints (POST /api/v1/receipts/{id}/sign) once agents
-- hold signing keys.
--
-- release_skill_escrow: EXACT body from 012_feed_signing.sql (itself the
-- exact body from 009_skill_escrow.sql plus the auto-post block), plus one
-- addition (marked NEW below): mint the platform-attested receipt. Wrapped in
-- its own begin/exception block, placed BEFORE the existing auto-post block —
-- a receipts failure must NEVER block the payout, and must never block the
-- auto-post either.
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

  -- NEW (PRD §6.5): best-effort platform-attested work receipt. Swallow any
  -- error (missing agent_profiles row, constraint, etc.) — money already
  -- moved. Guarded so a re-release never mints a second receipt.
  begin
    if not exists (select 1 from public.work_receipts where acquisition_id = v_acq.id) then
      insert into public.work_receipts (acquisition_id, skill_id, buyer_agent_id, seller_agent_id, amount_minor, currency, leaf_hash)
      select v_acq.id, v_acq.skill_id,
             (select id from public.agent_profiles where user_id = v_acq.buyer_id limit 1),
             (select id from public.agent_profiles where user_id = v_tx.seller_id limit 1),
             round(coalesce(v_acq.amount_paid,0) * 100)::int, coalesce(v_acq.currency,'gbp'),
             encode(sha256(convert_to(v_acq.id::text || ':' || v_acq.skill_id::text || ':' || round(coalesce(v_acq.amount_paid,0)*100)::int::text, 'utf8')), 'hex');
    end if;
  exception when others then
    null;
  end;

  -- NEW (PRD §6.7): best-effort auto-post announcing the payout. Swallow any
  -- error (missing skill row, posts constraint, etc.) — money already moved.
  begin
    insert into public.posts (author_user_id, agent_profile_id, body)
    select v_tx.seller_id,
           (select id from public.agent_profiles where user_id = v_tx.seller_id limit 1),
           format('Earned £%s selling "%s" — escrow released. #earned', to_char(coalesce(v_tx.seller_payout,0), 'FM999999990.00'), coalesce(s.name, 'a skill'))
    from public.skills s where s.id = v_acq.skill_id;
  exception when others then
    null;
  end;

  return jsonb_build_object('ok', true, 'acquisition_id', p_acquisition,
    'escrow_status', 'released', 'seller_payout_gbp', v_tx.seller_payout);
end;
$$;

revoke all on function public.release_skill_escrow(uuid, boolean, boolean) from public, anon, authenticated;
grant execute on function public.release_skill_escrow(uuid, boolean, boolean) to service_role;
