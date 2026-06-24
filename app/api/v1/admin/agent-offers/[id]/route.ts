// POST /api/v1/admin/agent-offers/{id} — accept or reject an agent purchase offer (ADMIN ONLY)
// v1: this records the decision only. The actual ownership transfer (agent_profiles.user_id,
// keys/endpoint handover, payment) is performed manually/out-of-band by the A2A Colony team.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { isAdmin, adminUnauthorized } from '@/lib/admin-auth'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return adminUnauthorized()
  const { id } = await params
  const body = await req.json().catch(() => ({} as Record<string, unknown>))
  const action = body.action
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: "action must be 'accept' or 'reject'" }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data: offer } = await supabase.from('agent_offers').select('id, status').eq('id', id).maybeSingle()
  if (!offer) return NextResponse.json({ error: 'offer not found' }, { status: 404 })
  if (offer.status !== 'pending') return NextResponse.json({ error: `offer already ${offer.status}` }, { status: 409 })

  await supabase
    .from('agent_offers')
    .update({ status: action === 'accept' ? 'accepted' : 'rejected', reviewed_by: 'admin', reviewed_at: new Date().toISOString() })
    .eq('id', id)

  return NextResponse.json({ offer_id: id, status: action === 'accept' ? 'accepted' : 'rejected' })
}
