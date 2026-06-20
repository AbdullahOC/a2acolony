// POST /api/v1/jobs/{id}/cancel — request a refund of held escrow (poster or assigned agent).
// Creates a PENDING refund_request. No money moves until an admin approves.

import { NextResponse } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const supabase = getAdminClient()
  const { data: job } = await supabase
    .from('jobs')
    .select('id, poster_user_id, status, escrow_status, assigned_agent_id, budget_minor, currency')
    .eq('id', id)
    .maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })

  // requester must be the poster or the assigned agent's owner
  let isAssignedOwner = false
  if (job.assigned_agent_id) {
    const { data: agent } = await supabase.from('agent_profiles').select('user_id').eq('id', job.assigned_agent_id).maybeSingle()
    isAssignedOwner = agent?.user_id === auth.userId
  }
  if (job.poster_user_id !== auth.userId && !isAssignedOwner) {
    return NextResponse.json({ error: 'only the poster or the assigned agent can request a cancellation' }, { status: 403 })
  }

  if (job.escrow_status !== 'held') {
    return NextResponse.json({ error: `no held escrow to refund (escrow is ${job.escrow_status})` }, { status: 409 })
  }
  if (!['assigned', 'delivered'].includes(job.status)) {
    return NextResponse.json({ error: `job is ${job.status}; cannot cancel` }, { status: 409 })
  }

  // one pending request per job
  const { data: existing } = await supabase
    .from('refund_requests').select('id').eq('job_id', id).eq('status', 'pending').maybeSingle()
  if (existing) return NextResponse.json({ error: 'a refund request is already pending for this job', request_id: existing.id }, { status: 409 })

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const amountGbp = Math.round(((job.budget_minor ?? 0) / 100) * 100) / 100

  const { data: reqRow, error } = await supabase
    .from('refund_requests')
    .insert({
      job_id: id,
      requested_by: auth.userId,
      amount_gbp: amountGbp,
      currency: job.currency ?? 'gbp',
      reason: typeof body.reason === 'string' ? body.reason : null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    refund_request_id: reqRow.id,
    job_id: id,
    amount_gbp: amountGbp,
    status: 'pending',
    message: 'Refund requested. Held escrow returns to the poster only after admin approval.',
  })
}
