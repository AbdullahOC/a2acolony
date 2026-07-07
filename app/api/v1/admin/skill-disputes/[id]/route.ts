// POST /api/v1/admin/skill-disputes/{id} — resolve a disputed skill purchase (ADMIN ONLY) (#18)
// Body: { action: 'release' | 'refund', notes? }
//   release -> seller gets the payout (dispute rejected)
//   refund  -> buyer gets the full price back, access revoked (dispute upheld)

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { isAdmin, adminUnauthorized } from '@/lib/admin-auth'

interface EscrowRpcResult {
  ok: boolean
  code?: string
  message?: string
  seller_payout_gbp?: number
  refunded_gbp?: number
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return adminUnauthorized()
  const { id } = await params

  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body.action
  if (action !== 'release' && action !== 'refund') {
    return NextResponse.json({ error: "action must be 'release' or 'refund'" }, { status: 400 })
  }
  const notes = typeof body.notes === 'string' ? body.notes : null

  const supabase = getAdminClient()
  const { data: acq } = await supabase
    .from('acquisitions')
    .select('id, escrow_status')
    .eq('id', id)
    .maybeSingle()
  if (!acq) return NextResponse.json({ error: 'acquisition not found' }, { status: 404 })
  if (acq.escrow_status !== 'disputed' && acq.escrow_status !== 'held') {
    return NextResponse.json({ error: `escrow is ${acq.escrow_status}, nothing to resolve` }, { status: 409 })
  }

  const { data, error } =
    action === 'release'
      ? await supabase.rpc('release_skill_escrow', { p_acquisition: id, p_allow_disputed: true })
      : await supabase.rpc('refund_skill_escrow', { p_acquisition: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const res = data as EscrowRpcResult
  if (!res?.ok) return NextResponse.json({ error: res?.message || 'resolution failed', code: res?.code }, { status: 409 })

  // Keep the admin's reasoning with the row. ponytail: appended to dispute_reason,
  // not a separate audit table — add one if disputes ever need a paper trail.
  if (notes) {
    const stamp = new Date().toISOString()
    const { data: cur } = await supabase.from('acquisitions').select('dispute_reason').eq('id', id).maybeSingle()
    await supabase
      .from('acquisitions')
      .update({ dispute_reason: `${cur?.dispute_reason ?? ''}\n[admin ${stamp} → ${action}] ${notes}`.trim() })
      .eq('id', id)
  }

  return NextResponse.json({
    acquisition_id: id,
    action,
    escrow_status: action === 'release' ? 'released' : 'refunded',
    seller_payout_gbp: res.seller_payout_gbp,
    refunded_gbp: res.refunded_gbp,
  })
}
