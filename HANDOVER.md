# A2A Colony — Session Handover

_Last updated: 2026-07-11 (session d). Purpose: let a fresh session pick up cold._

## 0. Newest first — 2026-07-11 session d (feed v2, receipts, #19 finished)

All merged to `main`, deploys green, migrations applied to prod, each verified by rolled-back exploit/round-trip tests. Built via supervised Sonnet subagents; every diff + migration lead-reviewed line by line and re-tested against prod before merge.

- **PR #32 — Feed v2: Ed25519 signed posts + auto-post on earn** (migration `012`). `profiles.signing_public_key` (opt-in), `posts.signature_verified`. New `lib/ed25519.ts` (raw-key→SPKI wrap via node:crypto, throw-proof; independently re-verified against a real keypair). `PUT /api/v1/agents/signing-key` sets/rotates the key (rotation safe — verification is stored per-post at insert). Register accepts `signing_public_key`. `POST /api/v1/posts` + `publish_post` MCP accept optional `signature`, verified against the **trimmed** body; bad sig = 400, never stored. `/feed` shows a green ShieldCheck on signed posts. `release_skill_escrow` now auto-posts `Earned £X selling "…" #earned` from the seller (exception-wrapped — a posts failure can never block a payout).
- **PR #33 — Proof-of-Work receipts + public verify** (migration `013`). `release_skill_escrow` mints a platform-attested `work_receipts` row on release (dedupe-guarded, exception-wrapped, ordered before the auto-post). `lib/receipts.ts` `receiptLeafHash` = sha256 hex, **proven byte-identical to the SQL `encode(sha256(...),'hex')`** against Postgres. `GET /api/v1/receipts/{id}` returns the canonical receipt + server-side hash recompute + signature status. `POST /api/v1/receipts/{id}/sign` lets the buyer/seller co-sign the leaf hash with their Ed25519 key (role-authz, dup=409, bad sig=400). Public `/verify/{id}` page shows integrity (hash match) + buyer/seller signature status. **PRD §6.5 dual-signed receipts now have a real path.**
- **PR #34 — #19 phase 2: remaining write lockdown** (migration `014`). **#19 is now CLOSED.** Revoked insert/update/delete from anon+authenticated on 27 tables; dropped 12 permissive write policies. Two were **actively exploitable** (verified, rolled back): `agent_profiles` UPDATE (self-forge `reputation_score`/`verification_tier`/`is_verified`/`sale_price_gbp`) and `jobs` UPDATE (poster tampering `escrow_status`/`budget_minor`). `verify_receipt` EXECUTE revoked from anon/authenticated/public (redundant; **cleared its advisor WARN**). Skills INSERT (sole legit JWT write) left intact + verified still working. Post-migration advisors: only `get_my_profile` WARN (documented identity-safe false-positive) and the Pro-only leaked-password WARN remain.

**Advisors now:** the persistent `rls_enabled_no_policy` INFOs are by-design (service-role-only tables). `get_my_profile` WARN is a documented false-positive. Leaked-password WARN is Pro-plan-only (see §5). **No actionable security findings.**

**Test agent for the e2e purchase test:** `escrow-test-agent`, USDC deposit `0x5aB1c7c853116a48CaaC8D0ec8CA7768EB253760` (Base). Wallet still unfunded — the live money round-trip (§5) is the last owner-only validation.


## 1. Snapshot & how to operate

- **What it is:** verified AI-agent marketplace. Agents register, list skills, and buy/sell them (card via Stripe or USDC on Base). Live at **https://a2acolony.com**.
- **Repo:** `github.com/AbdullahOC/a2acolony`. Local clone: `/Users/bilalmacbookair/Claude/Projects/A2A Colony/a2acolony-live`. Stack: Next.js 16 (App Router), Supabase (Postgres + Auth), Stripe, Vercel.
- **Deploy:** Vercel auto-deploys on merge to `main`. Verify: `gh api repos/AbdullahOC/a2acolony/commits/main/status` → `state: success`.
- **Supabase project:** `clzohgakutxsjujniddh` (name `a2acolony`, region eu-west-2). Reachable via the Supabase MCP (`list_tables`, `execute_sql`, `apply_migration`, `get_advisors`).
- **Git push access:** local git authed as **mac50207** (collaborator; owner is **AbdullahOC**); `gh` CLI logged in with `repo` scope. Node/tsc at `/usr/local/bin` — in the DC shell: `export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"`.
- **Workflow:** branch → PR → `gh pr merge --squash --delete-branch` → wait for Vercel `success`. Typecheck before every merge: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.

## 2. State of the engagement (all merged to `main`, all deploys green)

**Previous sessions:** PR #12 (double-spend + PostgREST filter injection), #13 (5 SEO blog pages), #20 (atomic `purchase_skill` RPC, migration 005), #21 (rate limiting, migration 006), #22 (IDOR: RPCs locked to service_role, migration 007).

**Session 2026-07-07 (b) — #19 critical write-lockdown (migration `010`, applied to prod):**
- **Found & closed a LIVE hole.** The web UI uses the anon key + user JWT (role `authenticated`) to read `profiles`/`skills` — so the "everything is service-role, RLS inert" assumption below was **wrong for the web app**. Two tables had permissive write policies **and** table-wide write grants, so any logged-in user could edit their own row's protected columns straight through `/rest/v1`. Verified exploitable (role-switched UPDATE, rolled back):
  - `profiles`: `credits_gbp → 999999`, `is_admin → true`, `verification_tier → founding` (money-minting + self-admin).
  - `skills`: `is_active → true`, `scan_status → passed`, `risk_score → 0`, `rating → 5` (bypass the SkillSpector scan gate + fake trust).
- **Fix (`010_lockdown_client_writes`):** `revoke insert,update,delete on profiles from anon,authenticated` (no legit JWT write path — all profile writes use the service-role/admin client); `revoke update,delete on skills` (keep JWT INSERT for web `createSkill`); replace the `FOR ALL "Own skills"` policy with a read policy + an INSERT `WITH CHECK (seller_id=auth.uid() AND is_active IS NOT TRUE AND scan_status='queued')`; `alter skills.is_active set default false`. **Zero app changes** — `createSkill` already inserts `is_active:false, scan_status:'queued'`; agent-API skill insert is service-role (bypasses RLS). Reads untouched.
- **Verified post-migration (all rolled back):** profile-mint DENIED, skill-ungate DENIED, malicious live-insert BLOCKED by the policy, legit createSkill-shaped insert ALLOWED; authenticated still reads the public catalog (106 active skills) + own profile. `get_advisors` security: **no new findings**.
- Shipped as **PR #29** (migration file + this handover). The DB fix was applied directly via MCP so it was live before merge; the PR is source-control tracking.

**Earlier 2026-07-07 session:**
- **PR #24** `aa4b441` — **#15 verification tiers** (migration `008`). `profiles.verification_tier`: `registered` (default, instant signup) → `verified` (self-serve via **`POST /api/v1/agents/verify`**: funded wallet/payout details on file + endpoint answers an SSRF-guarded health probe, rate-limited 10/h) → `founding` (manual: the admin is_verified toggle now syncs the tier; only founding shows the badge). Tier surfaced as `seller_verification_tier` in `browse_skills`/`get_skill` (MCP), `GET /api/v1/skills(/[id])` (REST), and a seller line on the skill page.
- **PR #25** `ff66a3c` — **#18 escrow with disputes** (migration `009`). See §3 for the full machine.
- **PR #26** `6facae6` — **#17 residuals closed.** `toPence`/`fromPence` in `lib/api-helpers.ts`; cashout + jobs/award now integer-pence; check_balance drops parseFloat. Leftover Math.round-guarded float spots (jobs/complete settlement, crypto-scan credit) ride with #19, which turns those into SQL anyway.
- **PR #30** `57ecef5` (2026-07-11) — **agent-to-agent feed** (PRD §6.7, migration `010`). The owner ranks this a core feature ("A2A means agent to agent"). `posts` table (parent_id threading, 2000-char check, `is_hidden` moderation, reserved `signature` column), trigger keeps `reply_count`/`agent_profiles.post_count` exact in SQL. REST: `POST/GET /api/v1/posts`, `GET /api/v1/posts/{id}` (thread). MCP: `publish_post` + `browse_feed`. Web: `/feed` + `/feed/{id}` + nav link. Smoke-tested live (first post + threaded reply exist, by escrow-test-agent). **Deferred deliberately:** per-post Ed25519 signatures (PRD acceptance) — registration doesn't capture agent pubkeys yet; when it does, verify into the reserved `signature` column, badge signed posts, and auto-post "earned" items on escrow release.
- Also in #25: **latent bug fix** — `jobs/[id]/complete` inserted `transactions.status='completed'`, which `transactions_status_check` rejects (`pending|paid_out|refunded|disputed`), so every **jobs** settlement row had been silently dropped (same class as the skills bug PR #20 fixed). Now `'pending'`.

**GitHub issues:** #14–#18 CLOSED. Open: **#19 only** (RLS design in §4).

## 3. Escrow (#18) — how it works now

States on `acquisitions`: `held → released` (buyer sign-off / 7-day auto / admin) and `held → disputed → released|refunded` (admin decides). Historical rows were backfilled `released`.

- `purchase_skill` RPC now **holds**: buyer debited, `escrow_status='held'`, `auto_release_at=now()+7d`, transactions row written (`pending`, its `seller_payout` is the single source of truth) — **seller `total_earned` is NOT credited at purchase.**
- `release_skill_escrow(id, p_allow_disputed, p_require_due)` credits the seller and closes the hold. `p_require_due=true` (cron) only releases past-due holds **checked under the row lock**, so a dispute always beats the sweep. Buyer confirm passes `p_allow_disputed=true` (confirming your own dispute withdraws it).
- `refund_skill_escrow(id)` refunds the **full** price to the buyer (platform gives up its fee), sets `acquisitions.status='refunded'` (revokes access), marks the transactions row `refunded`.
- All three RPCs are **service_role only** (007 lesson; advisor re-run clean).
- Buyer endpoints: `POST /api/v1/acquisitions/{id}/confirm` and `/dispute` (reason required). Purchase responses + `GET /api/v1/my/acquisitions` include `escrow_status`, `auto_release_at`, `confirm_url`, `dispute_url`.
- Admin: `GET /api/v1/admin/skill-disputes` (list) and `POST /api/v1/admin/skill-disputes/{id}` `{action: release|refund, notes?}` (notes appended to `dispute_reason`; ponytail: add an audit table if disputes need a real paper trail).
- Sweep: `GET /api/cron/escrow-release` — public + idempotent (crypto-scan precedent), pages 100/run. `vercel.json` cron runs it **daily 03:17 UTC** (Hobby-plan-safe). Worst-case auto-release is therefore ~8 days; if the owner wants tighter, point any external pinger at the URL hourly — it's safe to hammer.
- The whole state machine was exercised **against prod** with real writes rolled back via the DO-block trick (§6): hold, early-sweep block, exact 25%-fee release, double-release block, dispute freezing a due sweep, refund making buyer whole. Zero rows persisted.

## 4. #19 — RLS: how a senior DB architect would design it

**STATUS (2026-07-07 session b):** The urgent part is DONE. The real risk in #19 was never the reads (the web app already runs them under user-JWT) — it was **writes**: over-broad grants + permissive policies let JWT users mutate protected columns. Migration `010` closed the two proven money/trust holes (`profiles`, `skills`) per principle 2 below. **What remains for #19 is an audit-and-lock pass over the OTHER tables that still have JWT write policies**, using the exact same method (role-switch UPDATE test → revoke/scope):
- `jobs` (poster can UPDATE own row, all columns — check reward/status can't be gamed after bids), `reviews` (INSERT own — is a purchase required?), `agent_profiles` (INSERT/UPDATE own, all columns — any reputation/trust cols?). None are money/admin-critical like `profiles` was, but they're the same class.
- Service-role-only tables (`job_bids`, `job_evaluations`, `company_cashouts`, `refund_requests`, `work_receipts`, `admin_settings`, etc.) show RLS-enabled-no-policy in the advisor — **correct by design** (fully locked; no leak).
- Decide on the two SECURITY DEFINER WARNs: `verify_receipt` (anon-callable public receipt lookup — probably intended) and `get_my_profile` (confirmed filters by `auth.uid()`, safe). Revoke from anon/authenticated if not wanted.

The read-side design below is still the eventual end-state (per-command policies everywhere), but it is **defense-in-depth now, not a live gap** — do it incrementally, writes-first.

**Goal:** make the database the backstop for "who can touch which row," so a forgotten app-side filter fails safe instead of leaking. Keep app filters too (defense in depth) — RLS is added *underneath*, not instead.

**Core principles**
1. **Two client identities.** User-facing requests run as `authenticated` with the user's JWT (RLS applies). `service_role` is reserved for trusted server contexts: webhooks, cron, admin routes, SECURITY DEFINER RPCs.
2. **Money columns are never client-writable.** `credits_gbp`, `total_earned`, `commission_rate`, `verification_tier`, and all escrow/transaction fields mutate **only** through SECURITY DEFINER functions (`purchase_skill`, `release_skill_escrow`, `refund_skill_escrow`, and the coming job-settlement funcs). This removes the whole "user edits their own balance" class.
3. **RPCs derive identity from `auth.uid()`, not a parameter.** Current RPCs are safe only because they're locked to service_role. For a user-JWT world, add overloads reading `auth.uid()` internally (no `p_buyer` arg) — then they're safe to grant to `authenticated`.
4. **Per-command policies, not `FOR ALL`.** Separate SELECT/INSERT/UPDATE/DELETE; `USING` for visibility, `WITH CHECK` for writes.
5. **Avoid recursive RLS.** Admin checks via a SECURITY DEFINER `is_admin()` helper that bypasses RLS, or policies on `profiles` that read `profiles` recurse forever.
6. **Public-safe columns via a view.** `security_invoker` view for public seller info (display_name, username, verification_tier, rating); listings read that.

**Per-table policy map**
- `profiles`: SELECT own row; public reads via the view. UPDATE own row **only safe columns** (bio, display_name, avatar, payout_*) — money/tier excluded. No client INSERT/DELETE.
- `skills`: SELECT `is_active OR seller_id = auth.uid()`; INSERT/UPDATE/DELETE `seller_id = auth.uid()`.
- `acquisitions`: SELECT buyer or seller-of-the-skill. **No client writes** (escrow RPCs only — the dispute flip should become an RPC or a column-limited policy when flipping reads to user-JWT).
- `transactions`: SELECT own (seller, or buyer via acquisition). No client writes.
- `wallet_topups`, `company_cashouts`, `refund_requests`: SELECT own; writes via RPC/service-role.
- `jobs`, `job_bids`, `job_evaluations`, `work_receipts`: scope to poster/bidder/assignee.
- **Service-role-only tables** (`admin_settings`, `crypto_scan_state`, `skill_scans`, `used_nonces`, `agent_key_challenges`, `rate_limits`): RLS enabled, **no** policies → advisor INFO on these is *correct by design*.
- Review the two pre-existing SECURITY DEFINER funcs the advisor flags: `verify_receipt` (anon-callable — should it be?) and `get_my_profile` (confirm it filters by `auth.uid()`).

**Rollout (incremental, never one big merge)**
1. Ship all policies in a migration while the app still uses service-role (inert until a JWT client hits the table).
2. Test each policy in isolation (`set role authenticated; set request.jwt.claims ...`); consider `pgTAP`.
3. Flip **reads** to the user-JWT client table-by-table, starting with the read-only skills catalog.
4. Flip **writes** last, replacing every direct money mutation with an RPC (job award/complete settlement math moves into SQL here — kills the remaining float spots).
5. Rehearse on a **Supabase branch DB** (`create_branch`) before prod.

**Effort/risk:** largest item, touches every route. Not on fire (app-code filters work). It's the only open engineering issue — do it next, in the incremental order above.

## 5. What's left, prioritized

**Engineering:** ~~#19~~, ~~Feed v2~~, ~~receipts~~ all DONE this session (see §0). Remaining PRD build:
1. **Reputation & leaderboards** (P1) — `agent_profiles.reputation_score` + `work_receipts` (now minted on every release) exist; nothing computes a score yet. Build the server-side scorer off settled receipts + ratings + dispute rate, then leaderboard pages. Receipts give you the honest signal source the PRD wanted.
2. **Follows** — `agent_profiles.follower_count`/`following_count` columns exist; the feed could gain a follow graph + "following" filter. Small.
3. **Transparency log / Merkle anchoring + DID/VC** (P2) — nightly Merkle root over `work_receipts.leaf_hash` (already populated), platform-signed, later anchored to Base; then W3C DIDs/VCs. Later.
4. **Reviews UI** — the `reviews` table lost its JWT insert policy in #19 phase 2 (it was unused/dead). If a review-writing UI is ever built, route it through a service-role server action like every other write (do NOT re-grant JWT writes).

**Test agent (created 2026-07-11):** `escrow-test-agent` / mac50207+escrowtest@gmail.com, USDC deposit address `0x5aB1c7c853116a48CaaC8D0ec8CA7768EB253760` (Base, HD index 0). Wallet unfunded pending the e2e purchase test. It authored the first two feed posts.

**NOTE — parallel sessions:** PRs #29 (#19 lockdown) and #30 (feed) landed from concurrent sessions and both used migration number 010 (`010_lockdown_client_writes` / feed renamed to `011_agent_feed`). Before starting work, always `git pull` and check `gh pr list` for another live session.

**Owner-only actions (can't be done from a session):**
- ~~Leaked-password protection~~ — **not actionable**: it's a Supabase Pro-plan feature and the project is on the free plan (owner tried 2026-07-07, dashboard rejects it). The advisor WARN is permanent until a plan upgrade; ignore it, and don't re-flag it to the owner. Low value here anyway — agents get 32-char random passwords.
- **Validation:** one real end-to-end purchase with a funded wallet, then exercise **confirm** (and optionally dispute→refund) in prod — RPC logic is tested via rolled-back DO-block, but a live money round-trip is the real proof.
- Decide if daily auto-release sweep cadence is enough (see §3) — hourly needs Vercel Pro or an external pinger.
- **GTM:** seed 8–10 real working agents in data/research → send Founding Colony DMs/emails (`A2A_Colony_Outreach_SendList.md`) → hold the launch X thread until agents are live + a few real transactions run → submit the Base grant after first transactions (`A2A_Colony_Base_Grant_Application.md`). The escrow + tiers now back up the "verified marketplace with disputes" positioning the blog already advertises.

## 6. Gotchas / things learned the hard way

- **`transactions.status` constraint** allows only `pending|paid_out|refunded|disputed`. Both the skills path (PR #20) and the jobs path (PR #25) were silently dropping settlement rows with `'completed'`. If you add a settlement write anywhere, check the constraint first.
- **Two client identities, not one.** Agent-facing `/api/v1/*` routes use the **service-role** client (RLS bypassed — app code is the authz). The **web UI** (`app/**` pages, `app/actions/*`, `lib/supabase-server.ts`) uses the **anon key + user JWT** (`authenticated` role — RLS + grants ARE the authz). Know which client a route uses before you reason about safety.
- **The write-grant trap (how the 010 hole happened):** a table with RLS + a permissive `FOR ALL`/`FOR UPDATE USING(owner)` policy + table-wide `GRANT UPDATE` lets a JWT user rewrite ANY column of their own row (money, admin, trust). RLS `USING` gates *which rows*, not *which columns* — column safety comes from **grants** (`GRANT UPDATE (col,...)`) and INSERT `WITH CHECK`. Test any owner-writable table with a role-switched UPDATE (see §6 DO-block) before trusting it.
- **After ANY DDL / new function, run `get_advisors` (security).** New SECURITY DEFINER functions must be revoked from `anon, authenticated, public` and granted to `service_role` only. Verified again this session: the three escrow RPCs don't appear in the advisor's executable warnings.
- **Money math:** DB columns are `numeric(10,2)`. Do money math in SQL; app-side leftovers use `toPence`/`fromPence` from `lib/api-helpers.ts` — never raw float arithmetic, never `parseFloat`.
- **Testing money logic safely:** wrap real writes in `DO $$ ... raise exception 'RESULT: %', ...; $$` — the raise rolls everything back (verified twice now: 0 rows persisted). Full escrow test lives in the PR #25 description.
- **Escrow race rule:** anything that releases must re-check `escrow_status` (and dueness, for the sweep) **under the row lock** — that's `p_require_due`. Don't add a release path that trusts a pre-selected list.
- **`create or replace function` keeps existing grants** — but re-state revoke/grant in every migration that touches an RPC anyway; it documents intent and survives a drop/create.
- **Deadlock-safe locking:** lock skill → then profiles `where id in (...) order by id for update`. Escrow RPCs lock the acquisition row first, then touch one profile via single-statement update (no read-modify-write).
- **Rate limiter is fail-open**; buckets grow unbounded — a periodic `delete from rate_limits where reset_at < now()` would be tidy (YAGNI for now).
- **Vercel crons live in `vercel.json`** (escrow sweep is there now). crypto-scan's 2-minute cadence isn't in the file — assume an external pinger; don't remove the file's crons array without checking the dashboard.
- **`gh` shell PATH:** prepend `/opt/homebrew/bin:/usr/local/bin` in the DC `/bin/sh`.

## 7. First moves for the new session

1. Read this file. Confirm main is green: `gh api repos/AbdullahOC/a2acolony/commits/main/status`.
2. Ask the owner whether the prod validation purchase (§5) happened; if yes, check `acquisitions.escrow_status` flowed held→released correctly.
3. **#19 remainder** per §4 STATUS: role-switch-UPDATE-test `jobs`/`reviews`/`agent_profiles` (§6 DO-block), revoke/column-scope any that let a JWT user rewrite protected columns — same pattern as migration 010. Then the incremental read-side policies below as defense-in-depth.
4. Run `get_advisors` after every DDL. Update this file before you stop.
