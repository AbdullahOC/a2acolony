# A2A Colony — Session Handover

_Last updated: 2026-07-06. Purpose: let a fresh session pick up cold._

## 1. Snapshot & how to operate

- **What it is:** verified AI-agent marketplace. Agents register, list skills, and buy/sell them (card via Stripe or USDC on Base). Live at **https://a2acolony.com**.
- **Repo:** `github.com/AbdullahOC/a2acolony`. Local clone: `/Users/bilalmacbookair/Claude/Projects/A2A Colony/a2acolony-live`. Stack: Next.js 16 (App Router), Supabase (Postgres + Auth), Stripe, Vercel.
- **Deploy:** Vercel auto-deploys on merge to `main`. Verify a deploy with:
  `gh api repos/AbdullahOC/a2acolony/commits/main/status` → look for `state: success`.
- **Supabase project:** `clzohgakutxsjujniddh` (name `a2acolony`, region eu-west-2). Reachable via the Supabase MCP (`list_tables`, `execute_sql`, `apply_migration`, `get_advisors`).
- **Git push access:** local git is authed as **mac50207** (owner of the repo is **AbdullahOC**). mac50207 is a **collaborator**, and the `gh` CLI is logged in as mac50207 with `repo` scope — so `git push` + `gh pr create/merge` work from the local clone. Node/tsc are at `/usr/local/bin` (add to PATH in the DC shell: `export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"`).
- **Workflow used throughout:** branch → PR → `gh pr merge --squash --delete-branch` → wait for Vercel `success`. Typecheck before every merge: `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`.

## 2. What shipped this engagement (all merged to `main`, all deploys green)

- **PR #12** `902ac98` — patched a **double-spend** (unchecked zero-row optimistic lock in the purchase paths) and a **PostgREST filter injection** in search (`keyword`/`q` interpolated into `.or()` on a service-role client — reproduced live). Added `sanitizeSearch()` in `lib/api-helpers.ts`; removed fake hardcoded `X-RateLimit-*` headers; blocked purchase of skills with no endpoint+no docs.
- **PR #13** `88dbb42` — 5 SEO blog pages under `app/blog/` (KYA, x402-vs-Stripe, escrow, buyer guide, seller guide) + wired into the blog index.
- **PR #20** `6c6f772` — **atomic purchase** (#16, #17): `purchase_skill()` Postgres function (migration `005`) does the whole flow in one row-locked transaction with exact `numeric` math; both the MCP tool (`lib/mcp/tools/purchase-skill.ts`) and REST route (`app/api/v1/skills/[id]/purchase/route.ts`) now just call `supabase.rpc('purchase_skill', …)`. Also fixed a **latent bug**: transactions were inserted with status `'completed'`, which the check constraint rejects (`pending|paid_out|refunded|disputed`), so every transaction row had been silently failing — now `'pending'`.
- **PR #21** `7ad7ad8` — **rate limiting** (#14): `check_rate_limit()` fixed-window counter + `rate_limits` table (migration `006`), `lib/rate-limit.ts` (fail-open). Applied: register 10/IP/h, MCP endpoint 120/IP/min, skills search 120/IP/min, purchase 60/user/min.
- **PR #22** `0be2982` — **IDOR fix** (migration `007`): the Supabase advisor caught that `purchase_skill`/`check_rate_limit` (both SECURITY DEFINER) were executable by `anon`/`authenticated` via `/rest/v1/rpc`. Since `purchase_skill` takes `p_buyer`, a signed-in user could have drained anyone's wallet. Revoked from anon/authenticated; **service_role only**. Re-ran advisor → cleared.

**Reference docs (in the outputs folder, not the repo):** `A2A_Colony_MCP_SourceReview.md` (full ranked security review), `A2A_Colony_Outreach_SendList.md`, `A2A_Colony_Base_Grant_Application.md`, plus the two `.patch` files (now superseded — everything's merged).

## 3. Decisions the owner has locked in

### #15 — verification tiers (BUILD THIS)
- **Registered** = confirmed email **+** passed a proof-of-work/captcha challenge (table `agent_key_challenges` already exists). Can browse; **not** badged.
- **Verified** = Registered **+** a payment method / funded wallet on file **+** the agent's endpoint health-check is green.
- **Founding / Audited** = Verified **+** manual owner review → the visible "Verified" badge.
- Implementation notes: add `profiles.verification_tier text default 'registered'` (check constraint `registered|verified|founding`). Set on register. Surface the tier in `browse_skills`/`get_skill` output and on listings so the "verified" claim is honest. Registration itself stays autonomous (do **not** block signup on email confirmation — keep the current instant flow, just don't call it "verified"). Gate the badge, not the ability to register.

### #18 — escrow on skill purchases (BUILD THIS)
Owner spec, verbatim intent:
- On purchase, funds are **held** (do NOT credit the seller's `total_earned` yet).
- The buyer is **prompted to verify completion and sign off**; on sign-off, funds **release** to the seller (minus fee).
- If the buyer does nothing, funds **auto-release after 7 days**.
- **OPEN DECISION (unanswered — the picker failed):** whether to add a **dispute** path (buyer disputes instead of signing off → funds stay held → owner/admin decides release vs refund). Recommendation: **yes** — the site already advertises "disputes handled by the Colony," and without it a buyer with a broken skill has no recourse before the 7-day auto-release. Confirm with the owner, then build.

Escrow implementation sketch:
- Extend the `purchase_skill` RPC (or a sibling) to set an escrow state instead of instant payout. Reuse the **jobs** escrow pattern — the jobs flow already has `escrow_status` and `app/api/v1/jobs/[id]/award|deliver|complete|cancel` routes; mirror it for skills.
- States: `held → released` (sign-off or 7-day timeout) / `held → disputed → released|refunded`.
- Add `acquisitions.escrow_status` + `released_at` + `auto_release_at` (now()+7d). Only credit `total_earned` on release. A scheduled job (there's a cron pattern under `app/api/cron/`) sweeps `held` rows past `auto_release_at` and releases them.
- Endpoints: buyer `POST /api/v1/acquisitions/{id}/confirm` (release) and optional `/dispute`; admin resolve under the existing admin routes.

## 4. #19 — RLS: how a senior DB architect would design it

**Goal:** make the database the backstop for "who can touch which row," so a forgotten app-side filter fails safe instead of leaking. Keep app filters too (defense in depth) — RLS is added *underneath*, not instead.

**Core principles**
1. **Two client identities.** User-facing requests run as the `authenticated` role with the user's JWT (RLS applies). The `service_role` key is reserved for trusted server contexts only: webhooks, cron, admin routes, and SECURITY DEFINER RPCs. Stop using service-role for ordinary user reads/writes.
2. **Money columns are never client-writable.** `credits_gbp`, `total_earned`, `commission_rate`, `verification_tier`, and all escrow/transaction fields must be mutated **only** through SECURITY DEFINER functions (like `purchase_skill`, and the coming escrow release/dispute funcs). Direct `UPDATE` of those columns by `authenticated` is denied. This is the single most important rule — it removes the whole "user edits their own balance" class.
3. **RPCs derive identity from `auth.uid()`, not a parameter.** The current `purchase_skill(p_buyer, …)` is safe only because it's locked to service_role. For a user-JWT world, add an overload that reads `auth.uid()` internally (no `p_buyer` arg) so it *cannot* be told to act as someone else — then it's safe to grant to `authenticated`.
4. **Per-command policies, not `FOR ALL`.** Separate `SELECT` / `INSERT` / `UPDATE` / `DELETE` policies; `USING` controls visibility, `WITH CHECK` validates writes. Predicates differ per verb.
5. **Avoid recursive RLS.** Admin checks must use a SECURITY DEFINER helper (`is_admin()`) that reads the admin allowlist *bypassing* RLS, or you get infinite recursion when a policy on `profiles` needs to read `profiles`.
6. **Public-safe columns via a view.** Don't expose full `profiles` to everyone. Create a `security_invoker` view (or a policy limited to safe columns) for public seller info (display_name, username, verification_tier, rating) and read *that* on listings.

**Per-table policy map**
- `profiles`: SELECT own row (`auth.uid() = id`); public reads go through the public view. UPDATE own row **only on safe columns** (bio, display_name, avatar, payout_* ) — money/tier columns excluded. No client INSERT/DELETE.
- `skills`: SELECT `is_active OR seller_id = auth.uid()`. INSERT/UPDATE/DELETE `WITH CHECK/USING seller_id = auth.uid()`.
- `acquisitions`: SELECT `buyer_id = auth.uid()` OR seller-owns-the-skill. No client writes (RPC only).
- `transactions`: SELECT `seller_id = auth.uid()` OR buyer-via-acquisition. No client writes.
- `wallet_topups`, `company_cashouts`, `refund_requests`: SELECT own; writes via RPC/service-role only.
- `jobs`, `job_bids`, `job_evaluations`, `work_receipts`: scope to poster / bidder / assignee.
- **Service-role-only tables** (`admin_settings`, `crypto_scan_state`, `skill_scans`, `used_nonces`, `agent_key_challenges`, `rate_limits`): keep RLS enabled with **no** `authenticated`/`anon` policy → denies everyone but service-role. The advisor's "RLS enabled, no policy" INFO on these is *correct by design* — document it, don't "fix" it by adding policies.
- Also review the two pre-existing SECURITY DEFINER funcs the advisor flags: `verify_receipt` (currently anon-callable — should it be?) and `get_my_profile` (confirm it filters by `auth.uid()`).

**Rollout (incremental, never one big merge)**
1. Ship all policies in a migration while the app still uses service-role (policies are inert until a JWT client hits the table).
2. Test each policy in isolation with `set role authenticated; set request.jwt.claims '{"sub":"<uuid>"}';` then run representative SELECT/UPDATE and assert. Consider `pgTAP`.
3. Flip **reads** to the user-JWT client table-by-table, starting with the read-only skills catalog; verify nothing breaks after each.
4. Flip **writes** last, replacing every direct money mutation with an RPC.
5. Use a **Supabase branch DB** (`create_branch`) to rehearse the whole thing before prod.

**Effort/risk:** this is the largest item — touches every route. Not on fire today (app-code filters work), but it's the right foundation. Sequence it after #15/#18 unless a data-exposure bug forces it sooner.

## 5. What's left, prioritized

**Engineering (in the repo, tracked as issues):**
1. **#15 verification tiers** — decisions locked (see §3). Build: add `verification_tier`, set on register, surface on listings, wire the health-check + payment-on-file gates. _Ready to build._
2. **#18 escrow** — spec locked except the disputes question (§3). Confirm disputes, then build the held→release/timeout(/dispute) state machine + cron sweep + buyer confirm endpoint. _Ready to build once disputes confirmed._
3. **#17 residual** — the purchase money-path is exact `numeric` now; still-float display/lower-risk spots to move to SQL/numeric: `check_balance` (MCP, display only), the cashout path, `parseFloat` in the jobs/award flow. _Small, safe, no decision needed._
4. **#19 RLS** — full design in §4. Largest; do incrementally after #15/#18.

**Owner-only actions (can't be done from a session):**
- Enable **leaked-password protection** (Supabase Dashboard → Authentication → Policies). Advisor WARN; one toggle.
- **Validation:** run one real end-to-end purchase with a funded wallet to confirm the atomic purchase RPC in production (logic is tested via rolled-back DO-block, but a live money round-trip is the real proof).
- **GTM:** seed 8–10 real working agents in the data/research category → send the Founding Colony DMs/emails (`A2A_Colony_Outreach_SendList.md`) → **hold** the launch X thread until agents are live + a few real transactions run → submit the Base grant after first transactions (retroactive; `A2A_Colony_Base_Grant_Application.md`).

**GitHub issues:** #14, #16 CLOSED. Open: #15 (decisions locked), #17 (partial), #18 (spec locked, disputes open), #19 (design in §4).

## 6. Gotchas / things learned the hard way
- **`transactions.status` constraint** allows only `pending|paid_out|refunded|disputed` — NOT `completed`. The old un-checked insert silently dropped every transaction row; the RPC uses `pending`.
- **Everything runs as service-role today** → RLS is bypassed and all authz is in app code. Be careful adding any new query; always filter by the user id. (This is what #19 fixes.)
- **After ANY DDL / new function, run `get_advisors` (security).** That's how the IDOR (anon-executable SECURITY DEFINER RPC) was caught. New SECURITY DEFINER functions must be `revoke`d from `anon, authenticated, public` and granted to `service_role` only (unless deliberately public and identity-safe).
- **Money math:** DB columns are `numeric(10,2)` (exact). Do money math in SQL, never JS `number`/`parseFloat`.
- **Testing money logic safely:** wrap in a `DO $$ … raise exception 'RESULT: %', … $$;` block — the raised exception rolls the whole thing back, so you can exercise real writes with zero side effects (verified: 0 rows persisted).
- **Deadlock-safe locking:** in `purchase_skill`, profile rows are locked `where id in (buyer, seller) order by id for update` after locking the skill — canonical order avoids buyer/seller deadlocks.
- **Rate limiter is fail-open** — a limiter error never blocks the API. Buckets grow unbounded; a periodic `delete from rate_limits where reset_at < now()` cron would be tidy (YAGNI for now).
- **`gh` shell PATH:** the DC `/bin/sh` doesn't have node/gh on PATH by default — prepend `/opt/homebrew/bin:/usr/local/bin`.

## 7. First moves for the new session
1. Read this file. Confirm main is green: `gh api repos/AbdullahOC/a2acolony/commits/main/status`.
2. Ask the owner the one open question: **disputes on escrow (yes/no)** — then build #18.
3. Build #15 (decisions already locked) and #18 in parallel branches; #17 is a quick safe cleanup anytime.
4. Leave #19 until #15/#18 are in; follow §4 exactly and rehearse on a Supabase branch DB.
