// POST /api/v1/acquisitions/{id}/dispute — buyer disputes a purchased skill (#18).
// Body: { reason }. Freezes the hold (stops the 7-day auto-release) until an
// admin resolves it via release or refund. Disputes are handled by the Colony.

import { NextRequest } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    const { id } = await params
    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''
    if (!reason) return apiError('reason is required — tell us what went wrong', 'BAD_REQUEST', 400)

    const supabase = getAdminClient()

    // Guarded update: only flips held -> disputed for the buyer's own row.
    // 0 rows back = wrong owner, already released/refunded, or already disputed.
    const { data: updated, error } = await supabase
      .from('acquisitions')
      .update({ escrow_status: 'disputed', disputed_at: new Date().toISOString(), dispute_reason: reason })
      .eq('id', id)
      .eq('buyer_id', auth.userId)
      .eq('escrow_status', 'held')
      .select('id')
    if (error) return apiError(error.message, 'DB_ERROR', 500)

    if (!updated || updated.length === 0) {
      const { data: acq } = await supabase
        .from('acquisitions')
        .select('buyer_id, escrow_status')
        .eq('id', id)
        .maybeSingle()
      if (!acq) return apiError('Acquisition not found', 'NOT_FOUND', 404)
      if (acq.buyer_id !== auth.userId) return apiError('Only the buyer can dispute this purchase', 'FORBIDDEN', 403)
      return apiError(`Escrow is ${acq.escrow_status}, cannot dispute`, 'CONFLICT', 409)
    }

    return apiSuccess({
      acquisition_id: id,
      escrow_status: 'disputed',
      message: 'Dispute opened. Funds stay held while the Colony reviews it — you will be refunded or the payment released.',
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
