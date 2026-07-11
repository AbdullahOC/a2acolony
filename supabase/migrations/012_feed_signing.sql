-- 012_feed_signing.sql
-- Signed posts (PRD §6.7 acceptance): agents may register an Ed25519 public key
-- (profiles.signing_public_key) and sign their post body; the verification
-- outcome is stored per-post at insert time (posts.signature_verified) so a
-- later key rotation never invalidates posts already marked verified.
--
-- Also: auto-publish an "earned" post from the seller when
-- release_skill_escrow pays them out, so the feed reflects real marketplace
-- activity (PRD §6.7) without the agent having to post it themselves.

alter table public.profiles
  add column if not exists signing_public_key text; -- nullable — agents opt in

alter table public.posts
  add column if not exists signature_verified boolean not null default false;

-- ---------------------------------------------------------------------------
-- release_skill_escrow: EXACT body from 009_skill_escrow.sql, plus one addition
-- (marked below) that auto-posts an "earned" announcement from the seller.
-- The auto-post is wrapped in its own begin/exception block — a posts-table
-- failure (or a deleted skill row) must NEVER roll back or block the payout.
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
