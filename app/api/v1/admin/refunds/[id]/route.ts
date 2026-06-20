// POST /api/v1/admin/refunds/{id}  — approve or reject a refund request (ADMIN ONLY)
// Body: { action: 'approve' | 'reject', notes? }. On approve: returns held escrow to the poster and cancels the job.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { isAdmin, adminUnauthorized } from '@/lib/admin-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return adminUnauthorized()
  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body.action
  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 })
  }
  const notes = typeof body.notes === 'string' ? body.notes : null

  const supabase = getAdminClient()
  const { data: rr } = await supabase.from('refund_requests').select('*').eq('id', id).maybeSingle()
  if (!rr) return NextResponse.json({ error: 'refund request not found' }, { status: 404 })
  if (rr.status !== 'pending') return NextResponse.json({ error: `request already ${rr.status}` }, { status: 409 })

  const stamp = new Date().toISOString()

  if (action === 'reject') {
    await supabase.from('refund_requests').update({ status: 'rejected', reviewed_by: 'admin', reviewed_at: stamp, review_notes: notes, updated_at: stamp }).eq('id', id)
    return NextResponse.json({ refund_request_id: id, status: 'rejected' })
  }

  const { data: job } = await supabase.from('jobs').select('id, poster_user_id, escrow_status').eq('id', rr.job_id).maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (job.escrow_status !== 'held') return NextResponse.json({ error: `escrow is ${job.escrow_status}, cannot refund` }, { status: 409 })

  const amount = Number(rr.amount_gbp) || 0
  const { data: poster } = await supabase.from('profiles').select('credits_gbp').eq('id', job.poster_user_id).maybeSingle()
  const balance = Number(poster?.credits_gbp) || 0
  await supabase.from('profiles').update({ credits_gbp: Math.round((balance + amount) * 100) / 100 }).eq('id', job.poster_user_id)
  await supabase.from('jobs').update({ status: 'cancelled', escrow_status: 'refunded', updated_at: stamp }).eq('id', rr.job_id)
  await supabase.from('transactions').insert({
    job_id: rr.job_id,
    gross_amount: amount,
    platform_fee: 0,
    seller_payout: 0,
    currency: rr.currency ?? 'gbp',
    payment_provider: 'credits',
    provider_transaction_id: `refund:${id}`,
    status: 'refunded',
  })
  await supabase.from('refund_requests').update({ status: 'approved', reviewed_by: 'admin', reviewed_at: stamp, review_notes: notes, updated_at: stamp }).eq('id', id)

  return NextResponse.json({ refund_request_id: id, status: 'approved', refunded_gbp: amount, job_id: rr.job_id })
}
