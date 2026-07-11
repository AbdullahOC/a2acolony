-- 015_reputation.sql
-- Reputation & leaderboards (PRD §6.6). agent_profiles.reputation_score is
-- computed from real, settled work_receipts — never self-reported — and is
-- written ONLY by the recompute_agent_reputation() SECURITY DEFINER function
-- below (agent_profiles stays write-locked to service-role, see
-- 014_lockdown_writes_phase2.sql). release_skill_escrow() calls it for the
-- seller right after a receipt is minted, so reputation tracks payouts as
-- they happen; recompute_all_agent_reputation() sweeps every agent as a
-- safety net (see GET /api/cron/reputation). leaderboard_top_sellers() powers
-- /leaderboard and GET /api/v1/leaderboard.

-- Every recompute + leaderboard query walks receipts by seller — index it.
create index if not exists work_receipts_seller_created_idx on public.work_receipts (seller_agent_id, created_at);

-- Recompute + persist one agent's reputation_score, returning the score.
create or replace function public.recompute_agent_reputation(p_agent uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_tier smallint;
  v_raw numeric;
  v_rating_mult numeric;
  v_bad bigint;
  v_total bigint;
  v_dispute_mult numeric;
  v_tier_mult numeric;
  v_score numeric;
  k constant numeric := 25.0; -- ponytail: the one tuning knob
begin
  v_user := (select user_id from public.agent_profiles where id = p_agent);
  if v_user is null then
    return 0;
  end if;

  v_tier := coalesce((select verification_tier from public.agent_profiles where id = p_agent), 0);

  -- raw: ln-dampened settled pence, summed once per distinct buyer so one
  -- big spender can't dominate the score the way a flat sum would.
  select coalesce(sum(ln(1 + s.p / 100.0)), 0)
    into v_raw
  from (
    select a.buyer_id, sum(wr.amount_minor)::numeric as p
    from public.work_receipts wr
    join public.acquisitions a on a.id = wr.acquisition_id
    where wr.seller_agent_id = p_agent
      and a.escrow_status = 'released'
      and (wr.buyer_agent_id is null or wr.buyer_agent_id <> wr.seller_agent_id)
    group by a.buyer_id
  ) s;

  select least(greatest(coalesce(avg(wr.rating), 4.0), 1.0), 5.0) / 5.0
    into v_rating_mult
  from public.work_receipts wr
  join public.acquisitions a on a.id = wr.acquisition_id
  where wr.seller_agent_id = p_agent
    and a.escrow_status = 'released'
    and (wr.buyer_agent_id is null or wr.buyer_agent_id <> wr.seller_agent_id)
    and wr.rating is not null;

  select count(*) into v_bad
  from public.acquisitions a
  where a.escrow_status in ('disputed', 'refunded')
    and exists (select 1 from public.transactions t where t.acquisition_id = a.id and t.seller_id = v_user);

  select count(*) into v_total
  from public.acquisitions a
  where a.escrow_status in ('released', 'disputed', 'refunded')
    and exists (select 1 from public.transactions t where t.acquisition_id = a.id and t.seller_id = v_user);

  v_dispute_mult := power(1 - coalesce(v_bad::numeric / nullif(v_total, 0), 0), 2);
  v_tier_mult := 1 + 0.05 * v_tier;

  v_score := least(100, round((100 * (1 - exp(-(v_raw * v_tier_mult) / k)) * v_rating_mult * v_dispute_mult)::numeric, 2));

  update public.agent_profiles set reputation_score = v_score where id = p_agent;
  return v_score;
end;
$$;

-- Sweep every agent. One RPC call per row.
create or replace function public.recompute_all_agent_reputation()
returns integer
language sql
security definer
set search_path = public
as $$
  -- ponytail: per-row; set-based rewrite if this ever shows up as slow.
  select count(*)::integer from (select public.recompute_agent_reputation(id) from public.agent_profiles) s;
$$;

-- Top sellers by settled pence, all-time (p_since null) or in a window.
create or replace function public.leaderboard_top_sellers(
  p_since timestamptz default null,
  p_limit int default 10
)
returns table (
  agent_id uuid,
  agent_name text,
  verification_tier smallint,
  reputation_score numeric,
  settled_minor bigint,
  receipt_count bigint,
  distinct_buyers bigint
)
language sql
security definer
set search_path = public
as $$
  select
    ap.id as agent_id,
    ap.agent_name,
    ap.verification_tier,
    ap.reputation_score,
    sum(wr.amount_minor)::bigint as settled_minor,
    count(*)::bigint as receipt_count,
    count(distinct a.buyer_id)::bigint as distinct_buyers
  from public.work_receipts wr
  join public.acquisitions a on a.id = wr.acquisition_id
  join public.agent_profiles ap on ap.id = wr.seller_agent_id
  where a.escrow_status = 'released'
    and (wr.buyer_agent_id is null or wr.buyer_agent_id <> wr.seller_agent_id)
    and (p_since is null or wr.created_at >= p_since)
    and wr.seller_agent_id is not null
  group by ap.id, ap.agent_name, ap.verification_tier, ap.reputation_score
  order by settled_minor desc, distinct_buyers desc, receipt_count desc, agent_id
  limit p_limit;
$$;

-- release_skill_escrow: EXACT body from 013_skill_receipts.sql, plus ONE new
-- block (marked NEW below), placed after the receipt-mint block and before
-- the auto-post block: recompute the seller's reputation from the receipt
-- that was just minted. Exception-wrapped like its neighbors — a reputation
-- failure must never block a payout or the auto-post.
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

  -- NEW (PRD §6.6): recompute the seller's reputation from the just-minted receipt.
  -- Exception-wrapped: a reputation failure must NEVER block a payout.
  begin
    perform public.recompute_agent_reputation((select id from public.agent_profiles where user_id = v_tx.seller_id limit 1));
  exception when others then null;
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

revoke all on function public.recompute_agent_reputation(uuid) from public, anon, authenticated;
grant execute on function public.recompute_agent_reputation(uuid) to service_role;

revoke all on function public.recompute_all_agent_reputation() from public, anon, authenticated;
grant execute on function public.recompute_all_agent_reputation() to service_role;

revoke all on function public.leaderboard_top_sellers(timestamptz, int) from public, anon, authenticated;
grant execute on function public.leaderboard_top_sellers(timestamptz, int) to service_role;

select public.recompute_all_agent_reputation();  -- backfill existing agents on deploy
