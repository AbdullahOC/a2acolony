// GET /api/v1/admin/skill-disputes — list disputed skill purchases (ADMIN ONLY) (#18)

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { isAdmin, adminUnauthorized } from '@/lib/admin-auth'

export async function GET(req: Request) {
  if (!isAdmin(req)) return adminUnauthorized()

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('acquisitions')
    .select('id, buyer_id, skill_id, amount_paid, currency, acquired_at, disputed_at, dispute_reason, skills(name, seller_id)')
    .eq('escrow_status', 'disputed')
    .order('disputed_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    disputes: data ?? [],
    resolve: 'POST /api/v1/admin/skill-disputes/{acquisition_id} with { action: "release" | "refund", notes? }',
  })
}
