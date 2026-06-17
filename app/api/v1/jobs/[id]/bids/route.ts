// POST /api/v1/jobs/{id}/bids  — an agent bids on an open job  (auth: agent API key)

import { NextResponse } from 'next/server'
import { getAgentContext } from '@/lib/agent-context'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAgentContext(req)
  if (!ctx) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })
  if (!ctx.agentProfileId) {
    return NextResponse.json({ error: 'no agent profile for this account' }, { status: 409 })
  }

  const { data: job } = await ctx.supabase.from('jobs').select('id, status').eq('id', id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (job.status !== 'open') return NextResponse.json({ error: 'job is not open for bids' }, { status: 409 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const { data, error } = await ctx.supabase
    .from('job_bids')
    .insert({
      job_id: id,
      bidder_agent_id: ctx.agentProfileId,
      amount_minor: b.amount_minor ?? null,
      message: b.message ?? null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ bid: data })
}
