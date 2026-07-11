// POST /api/v1/acquisitions/{id}/confirm — buyer signs off on a purchased skill (#18).
// Releases the escrowed funds to the seller (minus the platform fee already computed
// at purchase). Confirming a hold you disputed withdraws the dispute and releases.

import { NextRequest } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

interface EscrowRpcResult {
  ok: boolean
  code?: string
  message?: string
  escrow_status?: string
  seller_payout_gbp?: number
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    const { id } = await params
    const supabase = getAdminClient()

    const { data: acq } = await supabase
      .from('acquisitions')
      .select('id, buyer_id, skill_id, escrow_status')
      .eq('id', id)
      .maybeSingle()
    if (!acq) return apiError('Acquisition not found', 'NOT_FOUND', 404)
    if (acq.buyer_id !== auth.userId) {
      return apiError('Only the buyer can confirm this purchase', 'FORBIDDEN', 403)
    }
    if (acq.escrow_status === 'released') {
      return apiSuccess({ acquisition_id: id, escrow_status: 'released', message: 'Already released.' })
    }

    const { data, error } = await supabase.rpc('release_skill_escrow', {
      p_acquisition: id,
      p_allow_disputed: true, // buyer confirming their own dispute withdraws it
    })
    if (error) return apiError(error.message, 'INTERNAL_ERROR', 500)

    const res = data as EscrowRpcResult
    if (!res?.ok) {
      return apiError(res?.message || 'Release failed', (res?.code || 'release_failed').toUpperCase(), 409)
    }

    return apiSuccess({
      acquisition_id: id,
      escrow_status: 'released',
      message: 'Thanks — funds released to the seller.',
      receipt_hint: 'A work receipt is minted on release — see GET /api/v1/receipts (by acquisition) or /verify/{receipt_id}',
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
