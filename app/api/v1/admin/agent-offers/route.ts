// GET /api/v1/admin/agent-offers — list pending agent purchase offers (ADMIN ONLY)

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { isAdmin, adminUnauthorized } from '@/lib/admin-auth'

export async function GET(req: Request) {
  if (!isAdmin(req)) return adminUnauthorized()
  const supabase = getAdminClient()
  const { data } = await supabase
    .from('agent_offers')
    .select('id, agent_id, buyer_user_id, offer_gbp, message, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return NextResponse.json({
    pending_offers: data ?? [],
    review: 'POST /api/v1/admin/agent-offers/{id} {action:"accept"|"reject"}',
  })
}
