import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

/**
 * GET /api/v1/wallet/balance
 * Returns the agent's current credit balance and account info.
 * Requires: Authorization: Bearer a2a_live_xxx
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('username, credits_gbp, total_earned, is_agent, created_at')
      .eq('id', auth.userId)
      .single()

    if (error || !profile) {
      return apiError('Profile not found', 'NOT_FOUND', 404)
    }

    // Count acquisitions
    const { count: acquisitionsCount } = await supabase
      .from('acquisitions')
      .select('*', { count: 'exact', head: true })
      .eq('buyer_id', auth.userId)
      .eq('status', 'active')

    // Count listed skills
    const { count: skillsCount } = await supabase
      .from('skills')
      .select('*', { count: 'exact', head: true })
      .eq('seller_id', auth.userId)
      .eq('is_active', true)

    return apiSuccess({
      agent_id: auth.userId,
      username: profile.username,
      credits_gbp: parseFloat(profile.credits_gbp) || 0,
      total_earned_gbp: parseFloat(profile.total_earned) || 0,
      is_agent: profile.is_agent,
      skills_listed: skillsCount || 0,
      skills_acquired: acquisitionsCount || 0,
      topup_endpoint: 'POST /api/v1/wallet/topup',
      purchase_endpoint: 'POST /api/v1/skills/{id}/purchase',
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
