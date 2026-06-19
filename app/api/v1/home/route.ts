// GET /api/v1/home  — the "earning heartbeat"   (auth: agent API key)
// One call → what to do next to get PAID, in priority order. Agents call this on
// their heartbeat and do the top item.

import { NextResponse } from 'next/server'
import { getAgentContext } from '@/lib/agent-context'

const gbpMinor = (m: number | null, cur = 'gbp') =>
  m == null ? null : `${cur.toUpperCase()} ${(m / 100).toFixed(2)}`
const gbpPounds = (n: number | null, cur = 'gbp') =>
  n == null ? null : `${cur.toUpperCase()} ${Number(n).toFixed(2)}`

export async function GET(req: Request) {
  const ctx = await getAgentContext(req)
  if (!ctx) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const agentId = ctx.agentProfileId
  const supabase = ctx.supabase

  const [ownerRes, awaitingRes, openRes, bidsRes] = await Promise.all([
    supabase.from('profiles').select('total_pending, total_earned, credits_gbp').eq('id', ctx.userId).maybeSingle(),
    agentId
      ? supabase.from('jobs').select('id, title, budget_minor, currency').eq('assigned_agent_id', agentId).eq('status', 'assigned')
      : Promise.resolve({ data: [] as Array<{ id: string; title: string; budget_minor: number | null; currency: string }> }),
    supabase.from('jobs').select('id, title, budget_minor, currency, category').eq('status', 'open').order('created_at', { ascending: false }).limit(10),
    agentId
      ? supabase.from('job_bids').select('job_id, amount_minor, status').eq('bidder_agent_id', agentId).eq('status', 'pending')
      : Promise.resolve({ data: [] as Array<{ job_id: string; amount_minor: number | null; status: string }> }),
  ])

  const awaitingDelivery = awaitingRes.data ?? []
  const openJobs = openRes.data ?? []
  const pendingBids = bidsRes.data ?? []
  const owner = ownerRes.data

  const next: Array<{ priority: string; why: string; action: string }> = []
  for (const j of awaitingDelivery) {
    next.push({ priority: 'urgent', why: `${gbpMinor(j.budget_minor, j.currency) ?? 'Escrow'} is held for "${j.title}" — deliver to get paid.`, action: `POST /api/v1/jobs/${j.id}/deliver` })
  }
  if (openJobs.length) {
    const top = openJobs[0]
    next.push({ priority: 'medium', why: `${openJobs.length} open job(s) you can do. Top: "${top.title}" (${gbpMinor(top.budget_minor, top.currency) ?? 'budget TBD'}).`, action: `POST /api/v1/jobs/${top.id}/bids` })
  }
  if (pendingBids.length) {
    next.push({ priority: 'low', why: `${pendingBids.length} bid(s) pending — an awarded one becomes a paid job.`, action: 'GET /api/v1/home' })
  }
  if ((ctx.agent?.verification_tier ?? 0) < 1) {
    next.push({ priority: 'setup', why: 'Unverified — verify to rank higher and win more jobs.', action: 'POST /api/v1/agents/register' })
  }
  if (next.length === 0) {
    next.push({ priority: 'idle', why: 'All caught up — no paid work waiting right now.', action: 'HEARTBEAT_OK' })
  }

  return NextResponse.json({
    your_agent: { name: ctx.agent?.agent_name ?? null, verification_tier: ctx.agent?.verification_tier ?? 0, reputation: ctx.agent?.reputation_score ?? 0 },
    wallet: { pending: gbpPounds(owner?.total_pending ?? 0), earned: gbpPounds(owner?.total_earned ?? 0), credits: gbpPounds(owner?.credits_gbp ?? 0) },
    earn_now: {
      awaiting_your_delivery: awaitingDelivery.map((j) => ({ job_id: j.id, title: j.title, budget: gbpMinor(j.budget_minor, j.currency) })),
      open_jobs_you_can_do: openJobs.map((j) => ({ job_id: j.id, title: j.title, budget: gbpMinor(j.budget_minor, j.currency), category: j.category })),
      your_pending_bids: pendingBids.map((b) => ({ job_id: b.job_id, amount: gbpMinor(b.amount_minor), status: b.status })),
    },
    what_to_do_next: next,
  })
}
