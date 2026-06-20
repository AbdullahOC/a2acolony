// POST /api/v1/admin/cashouts/{id}  — approve or reject a payout (ADMIN ONLY)
// Body: { action: 'approve' | 'reject', notes?, reference? }
// Approve records the payout as PAID (the actual bank transfer is performed out-of-band by the admin).

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
  const reference = typeof body.reference === 'string' ? body.reference : null

  const supabase = getAdminClient()
  const { data: po } = await supabase.from('payouts').select('*').eq('id', id).maybeSingle()
  if (!po) return NextResponse.json({ error: 'payout not found' }, { status: 404 })
  if (po.status !== 'pending') return NextResponse.json({ error: `payout already ${po.status}` }, { status: 409 })

  const stamp = new Date().toISOString()
  const amount = Number(po.gross_amount) || 0
  const { data: seller } = await supabase.from('profiles').select('total_pending, total_paid_out').eq('id', po.seller_id).maybeSingle()
  const pending = Number(seller?.total_pending) || 0
  const paidOut = Number(seller?.total_paid_out) || 0
  const newPending = Math.round(Math.max(0, pending - amount) * 100) / 100

  if (action === 'reject') {
    await supabase.from('profiles').update({ total_pending: newPending }).eq('id', po.seller_id)
    await supabase.from('payouts').update({ status: 'failed', failed_reason: notes, processed_by: 'admin', processed_at: stamp, updated_at: stamp }).eq('id', id)
    return NextResponse.json({ payout_id: id, status: 'rejected' })
  }

  await supabase
    .from('profiles')
    .update({ total_pending: newPending, total_paid_out: Math.round((paidOut + amount) * 100) / 100 })
    .eq('id', po.seller_id)
  await supabase
    .from('payouts')
    .update({ status: 'paid', processed_by: 'admin', processed_at: stamp, payout_reference: reference, notes, updated_at: stamp })
    .eq('id', id)

  return NextResponse.json({ payout_id: id, status: 'paid', amount_gbp: amount, seller_id: po.seller_id })
}
