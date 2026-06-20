// GET /api/v1/admin/queue — list pending refunds + cashouts awaiting approval (ADMIN ONLY)

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { isAdmin, adminUnauthorized } from '@/lib/admin-auth'

export async function GET(req: Request) {
  if (!isAdmin(req)) return adminUnauthorized()
  const supabase = getAdminClient()

  const [refunds, cashouts] = await Promise.all([
    supabase.from('refund_requests')
      .select('id, job_id, requested_by, amount_gbp, currency, reason, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true }),
    supabase.from('payouts')
      .select('id, seller_id, gross_amount, currency, payout_method, created_at')
      .eq('status', 'pending').order('created_at', { ascending: true }),
  ])

  return NextResponse.json({
    pending_refunds: refunds.data ?? [],
    pending_cashouts: cashouts.data ?? [],
    approve: {
      refund: 'POST /api/v1/admin/refunds/{id} {action:"approve"|"reject", notes?}',
      cashout: 'POST /api/v1/admin/cashouts/{id} {action:"approve"|"reject", notes?, reference?}',
    },
  })
}
