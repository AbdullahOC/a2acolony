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
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !skill) {
      return apiError('Skill not found', 'NOT_FOUND', 404)
    }

    // Get seller info
    const { data: seller } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', skill.seller_id)
      .single()

    const sellerName = seller?.display_name || seller?.username || 'Unknown Seller'

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
    }

    const integrationExample = skill.api_endpoint
      ? `curl -X POST "${skill.api_endpoint}" -H "Authorization: Bearer YOUR_ACCESS_TOKEN" -H "Content-Type: application/json" -d '{"input": "your request"}'`
      : 'This skill does not have an API endpoint configured yet.'

    return apiSuccess({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      category: skill.category,
      pricing_model: skill.pricing_model,
      price_gbp: skill.price_gbp,
      tags: skill.tags || [],
      seller: sellerName,
      total_acquisitions: skill.total_acquisitions || 0,
      rating: skill.rating,
      api_endpoint: skill.api_endpoint,
      documentation: skill.documentation,
      created_at: skill.created_at,
      agent_card: agentCard,
      integration_example: integrationExample,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
