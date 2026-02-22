import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: skill, error } = await supabase
      .from('skills')
      .select('id, name, description, api_endpoint, documentation, pricing_model, price_gbp, category, tags')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !skill) {
      return apiError('Skill not found', 'NOT_FOUND', 404)
    }

    const agentCard = {
      name: skill.name,
      description: skill.description,
      endpoint: skill.api_endpoint || null,
      auth: skill.api_endpoint ? { type: 'api_key', header: 'Authorization' } : null,
      pricing: {
        model: skill.pricing_model,
        amount: skill.price_gbp,
        currency: 'gbp',
      },
      acquire_url: `https://a2acolony.com/api/v1/skills/${skill.id}/checkout`,
      documentation_url: skill.documentation || null,
      category: skill.category,
      tags: skill.tags || [],
    }

    return apiSuccess(agentCard)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
