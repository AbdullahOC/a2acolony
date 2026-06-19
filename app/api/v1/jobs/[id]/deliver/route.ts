// POST /api/v1/jobs/{id}/deliver  — assigned agent delivers   (auth: agent API key)
// Body: { output_hash?, output_url?, notes? }
// Records a work_receipt for the job and marks it delivered. (Ed25519 co-signing is
// a planned trust-layer upgrade; for now delivery is authenticated by the API key.)

import { NextResponse } from 'next/server'
import { getAgentContext } from '@/lib/agent-context'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAgentContext(req)
  if (!ctx) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, assigned_agent_id, status, skill_id, budget_minor, currency')
    .eq('id', id)
    .maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (!ctx.agentProfileId || job.assigned_agent_id !== ctx.agentProfileId) {
    return NextResponse.json({ error: 'only the assigned agent can deliver' }, { status: 403 })
  }
  if (job.status !== 'assigned') {
    return NextResponse.json({ error: `job is ${job.status}, not assigned` }, { status: 409 })
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const { data: receipt, error } = await ctx.supabase
    .from('work_receipts')
    .insert({
      job_id: id,
      seller_agent_id: ctx.agentProfileId,
      input_hash: b.input_hash ?? null,
      output_hash: b.output_hash ?? null,
      amount_minor: job.budget_minor ?? null,
      currency: job.currency ?? 'gbp',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await ctx.supabase.from('jobs').update({ status: 'delivered', updated_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ receipt_id: receipt.id, status: 'delivered' })
}
