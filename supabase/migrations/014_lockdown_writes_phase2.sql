-- 014_lockdown_writes_phase2.sql
-- Close the remaining LIVE write attack surface (#19, phase 2).
--
-- Context: phase 1 (010_lockdown_client_writes.sql) locked down profiles and the
-- marketplace listing table, leaving exactly one legitimate user-JWT (`authenticated`
-- role) write path in the whole app: a seller INSERTing a new listing row (preserved by
-- 010, untouched here). Every other write in the product — admin actions, RPCs,
-- webhooks, and server actions that authenticate via JWT but then write with the
-- service-role client — already goes through the service-role client, which bypasses
-- RLS and table grants entirely. That means every remaining anon/authenticated INSERT/
-- UPDATE/DELETE grant, and every remaining permissive write RLS policy, is dead
-- surface at best and an active hole at worst.
--
-- Two holes were actively dangerous and are covered by this migration:
--   * agent_profiles UPDATE: self-update with no column guard let a caller forge
--     reputation_score, verification_tier, is_verified, sale_price_gbp.
--   * jobs UPDATE: poster self-update with no column guard let a caller tamper
--     escrow_status / budget_minor after the fact.
--
-- Fix: revoke the table-wide INSERT/UPDATE/DELETE grants for anon/authenticated on
-- every remaining client-facing table, and drop the now-redundant permissive write
-- policies so a future re-GRANT can't silently reopen them. The one table intentionally
-- left alone is the seller listing-insert table from phase 1 — its INSERT policy is the
-- sole legitimate JWT write path and is not touched here.
-- Reads are unchanged: no SELECT policy is touched anywhere in this file.

begin;

-- ── marketplace core ────────────────────────────────────────────────────────────
-- agent_profiles and jobs are the two actively-exploitable holes (see header).
revoke insert, update, delete on public.agent_profiles from anon, authenticated;
revoke insert, update, delete on public.jobs from anon, authenticated;
revoke insert, update, delete on public.reviews from anon, authenticated;
revoke insert, update, delete on public.acquisitions from anon, authenticated;

-- ── money ────────────────────────────────────────────────────────────────────────
-- All of these are written exclusively by the service-role client (webhooks, admin
-- actions, payout jobs). No JWT write path exists for any of them.
revoke insert, update, delete on public.transactions from anon, authenticated;
revoke insert, update, delete on public.payouts from anon, authenticated;
revoke insert, update, delete on public.wallet_topups from anon, authenticated;
revoke insert, update, delete on public.refund_requests from anon, authenticated;
revoke insert, update, delete on public.company_cashouts from anon, authenticated;
revoke insert, update, delete on public.crypto_deposits from anon, authenticated;
revoke insert, update, delete on public.crypto_deposit_addresses from anon, authenticated;

-- ── agent social / feed ──────────────────────────────────────────────────────────
revoke insert, update, delete on public.agent_offers from anon, authenticated;
revoke insert, update, delete on public.agent_posts from anon, authenticated;
revoke insert, update, delete on public.agent_comments from anon, authenticated;
revoke insert, update, delete on public.agent_follows from anon, authenticated;
revoke insert, update, delete on public.agent_post_likes from anon, authenticated;
revoke insert, update, delete on public.agent_messages from anon, authenticated;

-- ── tasks ────────────────────────────────────────────────────────────────────────
revoke insert, update, delete on public.task_proposals from anon, authenticated;
revoke insert, update, delete on public.task_participants from anon, authenticated;

-- ── misc / system ────────────────────────────────────────────────────────────────
revoke insert, update, delete on public.posts from anon, authenticated;
revoke insert, update, delete on public.admin_settings from anon, authenticated;
revoke insert, update, delete on public.crypto_scan_state from anon, authenticated;
revoke insert, update, delete on public.rate_limits from anon, authenticated;
revoke insert, update, delete on public.skill_scans from anon, authenticated;
revoke insert, update, delete on public.job_evaluations from anon, authenticated;
revoke insert, update, delete on public.agent_api_keys from anon, authenticated;
revoke insert, update, delete on public.agent_signing_keys from anon, authenticated;

-- ── drop the now-redundant permissive write policies ────────────────────────────
-- Dropping these makes the intent explicit so a future re-GRANT can't silently reopen the hole (same reasoning as 010).
drop policy if exists "Agents insert own profile" on public.agent_profiles;
drop policy if exists "Agents update own profile" on public.agent_profiles;
drop policy if exists "poster inserts own jobs" on public.jobs;
drop policy if exists "poster updates own jobs" on public.jobs;
drop policy if exists "users write own reviews" on public.reviews;
drop policy if exists "Agents comment" on public.agent_comments;
drop policy if exists "Agents manage follows" on public.agent_follows;
drop policy if exists "Agents send messages" on public.agent_messages;
drop policy if exists "Agents like posts" on public.agent_post_likes;
drop policy if exists "Authors manage posts" on public.agent_posts;
drop policy if exists "Proposers manage tasks" on public.task_proposals;
drop policy if exists "Agents join tasks" on public.task_participants;

-- ── SECURITY DEFINER function grants ─────────────────────────────────────────────
-- verify_receipt(uuid): redundant now that the public receipts API + /verify page read
-- via the service-role client; removing anon/authenticated EXECUTE clears the advisor
-- WARN and drops dead attack surface. Not dropping the function itself — other code or
-- migration history may still reference it.
revoke execute on function public.verify_receipt(uuid) from anon, authenticated, public;

-- get_my_profile() is intentionally left alone: it is authenticated-callable by design
-- and identity-safe (it filters by auth.uid() internally), so the advisor WARN on it is
-- a documented false-positive, not a bug. No grant change here on purpose.

commit;
