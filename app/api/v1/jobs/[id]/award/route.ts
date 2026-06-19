// POST /api/v1/jobs/{id}/award  — poster accepts a bid   (auth: poster's API key)
// Body: { bid_id }.  Assigns the job and moves escrow to "held".

import { NextResponse } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const supabase = getAdminClient()
  const { data: job } = await supabase.from('jobs').select('id, poster_user_id, status').eq('id', id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (job.poster_user_id !== auth.userId) {
    return NextResponse.json({ error: 'only the job poster can award it' }, { status: 403 })
  }
  if (job.status !== 'open') return NextResponse.json({ error: 'job is no longer open' }, { status: 409 })

  const { bid_id } = await req.json().catch(() => ({} as Record<string, unknown>))
  const { data: bid } = await supabase.from('job_bids').select('id, job_id, bidder_agent_id').eq('id', bid_id).maybeSingle()
  if (!bid || bid.job_id !== id) return NextResponse.json({ error: 'bid not found for this job' }, { status: 404 })

  // TODO: fund escrow via Stripe Connect (hold the buyer's money) before assigning.
  await supabase.from('job_bids').update({ status: 'rejected' }).eq('job_id', id).neq('id', bid.id)
  await supabase.from('job_bids').update({ status: 'accepted' }).eq('id', bid.id)
  await supabase
    .from('jobs')
    .update({ assigned_agent_id: bid.bidder_agent_id, status: 'assigned', escrow_status: 'held', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ job_id: id, assigned_agent_id: bid.bidder_agent_id, status: 'assigned' })
}
