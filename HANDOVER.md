# A2A Colony — Session Handover

_Last updated: 2026-07-07. Purpose: let a fresh session pick up cold._

## 1. Snapshot & how to operate

- **What it is:** verified AI-agent marketplace. Agents register, list skills, and buy/sell them (card via Stripe or USDC on Base). Live at **https://a2acolony.com**.
- **Repo:** `github.com/AbdullahOC/a2acolony`. Local clone: `/Users/bilalmacbookair/Claude/Projects/A2A Colony/a2acolony-live`. Stack: Next.js 16 (App Router), Supabase (Postgres + Auth), Stripe, Vercel.
- **Deploy:** Vercel auto-deploys on merge to `main`. Verify: `gh api repos/AbdullahOC/a2acolony/commits/main/status` → `state: success`.
- **Supabase project:** `clzohgakutxsjujniddh` (name `a2acolony`, region eu-west-2). Reachable via the Supabase MCP (`list_tables`, `execute_sql`, `apply_migration`, `get_advisors`).
- **Git push access:** local git authed as **mac50207** (collaborator; owner is **AbdullahOC**); `gh` CLI logged in with `repo` scope. Node/tsc at `/usr/local/bin` — in the DC shell: `export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"`.
- **Workflow:** branch → PR → `gh pr merge --squash --delete-branch` → wait for Vercel `success`. Typecheck before every merge: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.

## 2. State of the engagement (all merged to `main`, all deploys green)

**Previous sessions:** PR #12 (double-spend + PostgREST filter injection), #13 (5 SEO blog pages), #20 (atomic `purchase_skill` RPC, migration 005), #21 (rate limiting, migration 006), #22 (IDOR: RPCs locked to service_role, migration 007).

**This session (2026-07-07):**
- **PR #24** `aa4b441` — **#15 verification tiers** (migration `008`). `profiles.verification_tier`: `registered` (default, instant signup) → `verified` (self-serve via **`POST /api/v1/agents/verify`**: funded wallet/payout details on file + endpoint answers an SSRF-guarded health probe, rate-limited 10/h) → `founding` (manual: the admin is_verified toggle now syncs the tier; only founding shows the badge). Tier surfaced as `seller_verification_tier` in `browse_skills`/`get_skill` (MCP), `GET /api/v1/skills(/[id])` (REST), and a seller line on the skill page.
- **PR #25** `ff66a3c` — **#18 escrow with disputes** (migration `009`). See §3 for the full machine.
- **PR #26** `6facae6` — **#17 residuals closed.** `toPence`/`fromPence` in `lib/api-helpers.ts`; cashout + jobs/award now integer-pence; check_balance drops parseFloat. Leftover Math.round-guarded float spots (jobs/complete settlement, crypto-scan credit) ride with #19, which turns those into SQL anyway.
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

**Engineering:** only **#19** (see §4).

**Owner-only actions (can't be done from a session):**
- Enable **leaked-password protection** (Supabase Dashboard → Authentication → Policies). Advisor WARN; one toggle.
- **Validation:** one real end-to-end purchase with a funded wallet, then exercise **confirm** (and optionally dispute→refund) in prod — RPC logic is tested via rolled-back DO-block, but a live money round-trip is the real proof.
- Decide if daily auto-release sweep cadence is enough (see §3) — hourly needs Vercel Pro or an external pinger.
- **GTM:** seed 8–10 real working agents in data/research → send Founding Colony DMs/emails (`A2A_Colony_Outreach_SendList.md`) → hold the launch X thread until agents are live + a few real transactions run → submit the Base grant after first transactions (`A2A_Colony_Base_Grant_Application.md`). The escrow + tiers now back up the "verified marketplace with disputes" positioning the blog already advertises.

## 6. Gotchas / things learned the hard way

- **`transactions.status` constraint** allows only `pending|paid_out|refunded|disputed`. Both the skills path (PR #20) and the jobs path (PR #25) were silently dropping settlement rows with `'completed'`. If you add a settlement write anywhere, check the constraint first.
- **Everything runs as service-role today** → RLS bypassed; all authz is app code. Always filter by user id on any new query. (#19 fixes.)
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
3. Start **#19** exactly per §4 — policies-first migration (inert), then flip reads table-by-table on a branch DB.
4. Run `get_advisors` after every DDL. Update this file before you stop.
