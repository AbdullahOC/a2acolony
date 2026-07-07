// POST /api/v1/jobs/{id}/complete  — poster confirms the work  (auth: poster's API key)
// Releases escrow and marks the job completed.

import { NextResponse } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const supabase = getAdminClient()
  const { data: job } = await supabase.from('jobs').select('id, poster_user_id, status, assigned_agent_id, budget_minor, currency').eq('id', id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (job.poster_user_id !== auth.userId) {
    return NextResponse.json({ error: 'only the job poster can confirm' }, { status: 403 })
  }
  if (job.status !== 'delivered') {
    return NextResponse.json({ error: `job is ${job.status}, not delivered` }, { status: 409 })
  }

  // Escrow release: pay the assigned agent's owner from the held budget, taking the platform commission.
  const budgetGbp = Math.round(((job.budget_minor ?? 0) / 100) * 100) / 100
  let sellerPayout = 0
  let platformFee = 0
  let commissionRate = 0

  if (budgetGbp > 0 && job.assigned_agent_id) {
    // assigned_agent_id -> agent_profiles.id -> owner profile (user_id)
    const { data: agent } = await supabase
      .from('agent_profiles')
      .select('user_id')
      .eq('id', job.assigned_agent_id)
      .maybeSingle()
    const sellerUserId = agent?.user_id ?? null

    if (sellerUserId) {
      const { data: seller } = await supabase
        .from('profiles')
        .select('commission_rate, total_earned')
        .eq('id', sellerUserId)
        .maybeSingle()
      commissionRate = Number(seller?.commission_rate ?? 25)
      platformFee = Math.round(budgetGbp * (commissionRate / 100) * 100) / 100
      sellerPayout = Math.round((budgetGbp - platformFee) * 100) / 100

      // credit the seller's earnings (mirrors the skills-purchase settlement)
      const currentEarned = Number(seller?.total_earned ?? 0)
      await supabase
        .from('profiles')
        .update({ total_earned: Math.round((currentEarned + sellerPayout) * 100) / 100 })
        .eq('id', sellerUserId)

      // record the settlement
      await supabase.from('transactions').insert({
        job_id: job.id,
        seller_id: sellerUserId,
        gross_amount: budgetGbp,
        platform_fee: platformFee,
        seller_payout: sellerPayout,
        commission_rate: commissionRate,
        currency: job.currency ?? 'gbp',
        payment_provider: 'credits',
        provider_transaction_id: job.id,
        // 'completed' violates transactions_status_check (pending|paid_out|refunded|disputed)
        // and the un-checked insert was silently dropping every jobs settlement row —
        // same latent bug PR #20 fixed for skill purchases. Credits await payout: 'pending'.
        status: 'pending',
      })
    }
  }

  await supabase
    .from('jobs')
    .update({ status: 'completed', escrow_status: budgetGbp > 0 ? 'released' : 'unfunded', updated_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ job_id: id, status: 'completed', seller_payout_gbp: sellerPayout, platform_fee_gbp: platformFee, commission_rate: commissionRate })
}
