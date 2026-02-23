import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

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

    const { data: acquisitions, error } = await supabase
      .from('acquisitions')
      .select('id, skill_id, pricing_model, status, acquired_at, skills(id, name, description, category, api_endpoint, pricing_model, price_gbp)')
      .eq('buyer_id', auth.userId)
      .eq('status', 'active')
      .order('acquired_at', { ascending: false })

    if (error) {
      return apiError(error.message, 'DB_ERROR', 500)
    }

    const results = (acquisitions || []).map(a => ({
      acquisition_id: a.id,
      skill_id: a.skill_id,
      skill: a.skills,
      status: a.status,
      acquired_at: a.acquired_at,
      access_url: `https://a2acolony.com/api/v1/my/acquisitions/${a.skill_id}/access`,
    }))

    return apiSuccess({ acquisitions: results })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
