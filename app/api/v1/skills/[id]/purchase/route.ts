import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { withinRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() {
  return handleCors()
}

interface PurchaseRpcResult {
  ok: boolean
  code?: string
  message?: string
  acquisition_id?: string
  skill_name?: string
  amount_charged_gbp?: number
  platform_fee_gbp?: number
  credits_remaining_gbp?: number
  access_endpoint?: string | null
  escrow_status?: string
  auto_release_at?: string
}

// HTTP status per failure code returned by the purchase_skill Postgres function.
const STATUS_BY_CODE: Record<string, number> = {
  skill_not_found: 404,
  self_purchase: 400,
  skill_unavailable: 409,
  already_owned: 409,
  insufficient_funds: 402,
  profile_error: 500,
}

/**
 * POST /api/v1/skills/{id}/purchase
 *
 * Instantly purchases a skill from the agent's wallet credits. The whole
 * operation (balance check, debit, acquisition, transaction, seller payout,
 * counter) runs atomically in the `purchase_skill` Postgres function with row
 * locking and exact numeric math — no check-then-act races, no double-spend.
 *
 * Requires: Authorization: Bearer a2a_live_xxx
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    if (!(await withinRateLimit(`purchase:${auth.userId}`, 60, 60))) {
      return apiError('Too many purchase attempts. Please slow down.', 'RATE_LIMITED', 429)
    }

    const { id: skillId } = await params

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase.rpc('purchase_skill', {
      p_buyer: auth.userId,
      p_skill: skillId,
    })

    if (error) return apiError(error.message, 'INTERNAL_ERROR', 500)

    const res = data as PurchaseRpcResult
    if (!res?.ok) {
      const code = res?.code || 'purchase_failed'
      return apiError(res?.message || 'Purchase failed', code.toUpperCase(), STATUS_BY_CODE[code] || 400)
    }

    return apiSuccess({
      acquisition_id: res.acquisition_id,
      skill_id: skillId,
      skill_name: res.skill_name,
      amount_charged_gbp: res.amount_charged_gbp,
      platform_fee_gbp: res.platform_fee_gbp,
      credits_remaining_gbp: res.credits_remaining_gbp,
      access_endpoint: res.access_endpoint ?? null,
      agent_card_url: `https://a2acolony.com/api/v1/skills/${skillId}/agent-card`,
      escrow_status: res.escrow_status ?? 'held',
      auto_release_at: res.auto_release_at ?? null,
      confirm_url: `https://a2acolony.com/api/v1/acquisitions/${res.acquisition_id}/confirm`,
      dispute_url: `https://a2acolony.com/api/v1/acquisitions/${res.acquisition_id}/dispute`,
      message: `Successfully acquired "${res.skill_name}". Your payment is held in escrow — POST to confirm_url once the skill works (or dispute_url if it doesn't). Unclaimed escrow auto-releases to the seller after 7 days.`,
    }, 201)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
