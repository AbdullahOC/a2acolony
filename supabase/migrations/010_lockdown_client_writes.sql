-- 010_lockdown_client_writes.sql
-- Close a LIVE privilege-escalation / money-minting hole (part of #19).
--
-- Context: the web UI uses the anon key + user JWT (role `authenticated`) to read
-- profiles/skills. RLS is enabled, but two tables had permissive write policies AND
-- table-wide write grants, so a logged-in user could edit their own row's protected
-- columns directly via the public REST API:
--   * profiles: set credits_gbp = 999999, is_admin = true, verification_tier = 'founding'
--   * skills:   set is_active = true, scan_status = 'passed', risk_score = 0, rating = 5
--               (bypassing the SkillSpector scan gate and faking trust signals)
-- Both were verified exploitable (role-switched UPDATE succeeded), then rolled back.
--
-- Fix: all legitimate writes to these tables already go through the service-role
-- client (admin actions, RPCs, webhooks) or the column-safe skill INSERT in the web
-- app. So we revoke JWT write access entirely, and guard the one remaining JWT write
-- path (seller creating a skill) so it cannot self-list or self-pass the scan.
-- Reads are unchanged. Service-role bypasses RLS + grants, so server paths are unaffected.

begin;

-- ── profiles ────────────────────────────────────────────────────────────────
-- No user-JWT write path exists (ensureProfile and every profile mutation use the
-- service-role/admin client). Revoke all client writes; SELECT stays (already
-- column-limited and excludes money/admin columns).
revoke insert, update, delete on public.profiles from anon, authenticated;

-- The permissive "Own profile" UPDATE policy is now backed by no write grant, but
-- drop it so intent is explicit and a future re-grant doesn't silently reopen the hole.
drop policy if exists "Own profile" on public.profiles;

-- ── skills ──────────────────────────────────────────────────────────────────
-- Sellers legitimately INSERT skills via the web app (JWT). UPDATE/DELETE have no
-- JWT path (listing edits and admin actions use the service-role client), so revoke
-- them. The scan callback, purchase RPC, etc. run as service-role and are unaffected.
revoke update, delete on public.skills from anon, authenticated;

-- Make "hidden until scanned" a database default instead of relying on every insert
-- site to remember is_active:false.
alter table public.skills alter column is_active set default false;

-- Replace the FOR ALL "Own skills" policy (which allowed sellers to flip protected
-- columns) with a read policy + an INSERT policy that pins the safe initial state.
drop policy if exists "Own skills" on public.skills;

create policy "own skills read" on public.skills
  for select using (auth.uid() = seller_id);

create policy "own skills insert" on public.skills
  for insert with check (
    auth.uid() = seller_id
    and is_active is not true
    and scan_status = 'queued'
  );
-- Note: "Public skills" (SELECT where is_active) is untouched. No UPDATE/DELETE policy
-- is created for JWT users on purpose — those mutations are service-role only.

commit;
