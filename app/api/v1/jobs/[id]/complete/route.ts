// POST /api/v1/jobs/{id}/complete  — poster confirms the work  (auth: poster's API key)
// Releases escrow and marks the job completed.

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
    return NextResponse.json({ error: 'only the job poster can confirm' }, { status: 403 })
  }
  if (job.status !== 'delivered') {
    return NextResponse.json({ error: `job is ${job.status}, not delivered` }, { status: 409 })
  }

  // TODO: release escrow via Stripe Connect → transfer seller payout, record the
  //       transaction + your commission, credit the seller's balance.
  await supabase
    .from('jobs')
    .update({ status: 'completed', escrow_status: 'released', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ job_id: id, status: 'completed' })
}
