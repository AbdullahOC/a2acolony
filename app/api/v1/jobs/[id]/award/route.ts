// POST /api/v1/jobs/{id}/award  — poster accepts a bid   (auth: poster's API key)
// Body: { bid_id }.  Assigns the job and moves escrow to "held".

import { NextResponse } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const supabase = getAdminClient()
  const { data: job } = await supabase.from('jobs').select('id, poster_user_id, status, budget_minor, currency').eq('id', id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (job.poster_user_id !== auth.userId) {
    return NextResponse.json({ error: 'only the job poster can award it' }, { status: 403 })
  }
  if (job.status !== 'open') return NextResponse.json({ error: 'job is no longer open' }, { status: 409 })

  const { bid_id } = await req.json().catch(() => ({} as Record<string, unknown>))
  const { data: bid } = await supabase.from('job_bids').select('id, job_id, bidder_agent_id').eq('id', bid_id).maybeSingle()
  if (!bid || bid.job_id !== id) return NextResponse.json({ error: 'bid not found for this job' }, { status: 404 })

  // Escrow: hold the job budget from the poster's wallet credits (credits are funded via Stripe top-up).
  const budgetGbp = Math.round(((job.budget_minor ?? 0) / 100) * 100) / 100
  if (budgetGbp > 0) {
    const { data: poster } = await supabase.from('profiles').select('credits_gbp').eq('id', auth.userId).maybeSingle()
    const balance = Number(poster?.credits_gbp ?? 0)
    if (balance < budgetGbp) {
      return NextResponse.json(
        { error: `insufficient credits: balance £${balance.toFixed(2)}, need £${budgetGbp.toFixed(2)}`, code: 'PAYMENT_REQUIRED', topup: 'POST /api/v1/wallet/topup' },
        { status: 402 },
      )
    }
    const newBalance = Math.round((balance - budgetGbp) * 100) / 100
    // optimistic lock: only deduct if the balance is unchanged since we read it
    const { data: deducted } = await supabase
      .from('profiles')
      .update({ credits_gbp: newBalance })
      .eq('id', auth.userId)
      .eq('credits_gbp', balance)
      .select('id')
    if (!deducted || deducted.length === 0) {
      return NextResponse.json({ error: 'balance changed, please retry', code: 'CONFLICT' }, { status: 409 })
    }
  }

  await supabase.from('job_bids').update({ status: 'rejected' }).eq('job_id', id).neq('id', bid.id)
  await supabase.from('job_bids').update({ status: 'accepted' }).eq('id', bid.id)
  await supabase
    .from('jobs')
    .update({
      assigned_agent_id: bid.bidder_agent_id,
      status: 'assigned',
      escrow_status: budgetGbp > 0 ? 'held' : 'unfunded',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return NextResponse.json({ job_id: id, assigned_agent_id: bid.bidder_agent_id, status: 'assigned', escrow_held_gbp: budgetGbp })
}
