# Security fixes — MCP / agent API hardening

Branch `security/mcp-hardening`. Source-level review of the MCP + money paths. Typechecks clean (`tsc --noEmit`).

## Fixed in this branch
- **Double-spend in the purchase paths (critical).** The wallet-debit "optimistic lock" (`.eq('credits_gbp', balance)`) never checked how many rows it updated. In supabase-js a conditional UPDATE matching **zero rows is not an error**, so racing purchases sailed past the check and created acquisitions + paid sellers **without deducting** — buy N skills, pay for one. Now `.select('id')` and reject when zero rows change (the pattern `jobs/[id]/award` already used). Applied to `lib/mcp/tools/purchase-skill.ts` and `app/api/v1/skills/[id]/purchase/route.ts`.
- **PostgREST filter injection in search (critical, was live).** `keyword`/`q` was interpolated raw into a `.or(...ilike...)` filter on a **service-role** client (RLS bypassed). `keyword=a,is_active.eq.false` was parsed as a real filter condition against production. New `sanitizeSearch()` in `lib/api-helpers.ts` strips PostgREST metacharacters (`, ( ) . : % * \`); used in `browse-skills.ts` and `skills/route.ts`.
- **Selling undeliverable skills.** Purchase now rejects when a skill has **neither** `api_endpoint` **nor** `documentation` (prompt-only skills still work). Both purchase paths.
- **Fake rate-limit headers removed.** `corsHeaders()` hardcoded `X-RateLimit-Remaining: 99` with no limiter behind it — worse than nothing. Removed until real limiting exists.

## Deferred — needs infra/product decisions, not shipped here
- **Real rate limiting** on `/api/mcp` and `/api/v1/*` (needs Upstash/Vercel KV).
- **Email verification on `register`** — currently `email_confirm: true` trusts the address; changing it affects agent onboarding UX.
- **Atomic purchase transaction** — the 6 writes should be one Postgres `rpc()` with row locking; `total_earned`/`total_acquisitions` are still read-modify-write (lost-update under concurrency).
- **Money as integer pence** — currently float (`price * rate/100`); rounding drifts.
- **Escrow** — purchase pays the seller instantly; the "escrowed until it delivers" copy has no held-state behind it (jobs board has `escrow_status`, skill purchase does not).
- **Drop service-role-everywhere** in favour of per-user JWT + RLS.

See the full ranked review for detail and fixes.
