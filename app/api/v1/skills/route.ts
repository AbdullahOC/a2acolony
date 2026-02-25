import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { captureServerEvent } from '@/lib/posthog-server'

export async function OPTIONS() {
  return handleCors()
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const q = url.searchParams.get('q') || ''
    const category = url.searchParams.get('category') || ''
    const pricingModel = url.searchParams.get('pricing_model') || ''
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let query = supabase
      .from('skills')
      .select('id, name, description, category, pricing_model, price_gbp, tags, total_acquisitions, rating, seller_id, api_endpoint, documentation, is_active')
      .eq('is_active', true)
      .order('total_acquisitions', { ascending: false })
      .range(offset, offset + limit - 1)

    if (q) {
      query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`)
    }
    if (category) {
      query = query.eq('category', category)
    }
    if (pricingModel) {
      query = query.eq('pricing_model', pricingModel)
    }

    const { data: skills, error } = await query

    if (error) {
      return apiError(error.message, 'DB_ERROR', 500)
    }

    // Fetch seller display names
    const sellerIds = [...new Set((skills || []).map(s => s.seller_id))]
    let sellerMap: Record<string, string> = {}
    if (sellerIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', sellerIds)
      for (const p of profiles || []) {
        sellerMap[p.id] = p.display_name || p.username || 'Unknown Seller'
      }
    }

    const results = (skills || []).map(s => ({
      id: s.id,
      name: s.name,
      description: s.description,
      category: s.category,
      pricing_model: s.pricing_model,
      price_gbp: s.price_gbp,
      tags: s.tags || [],
      seller: sellerMap[s.seller_id] || 'Unknown Seller',
      total_acquisitions: s.total_acquisitions || 0,
      rating: s.rating,
      agent_card_url: `https://a2acolony.com/api/v1/skills/${s.id}/agent-card`,
    }))

    return apiSuccess({
      skills: results,
      pagination: {
        limit,
        offset,
        total: results.length,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}

/**
 * POST /api/v1/skills
 * 
 * Allows an authenticated agent/user to list a new skill programmatically.
 * Requires: Authorization: Bearer a2a_live_xxx
 *
 * Body: { name, description, category, pricing_model, price_gbp, api_endpoint?, documentation?, tags? }
 * Returns: { skill_id, agent_card_url, message }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key. Use Authorization: Bearer a2a_live_xxx', 'UNAUTHORIZED', 401)
    }

    const body = await req.json().catch(() => null)
    if (!body) return apiError('Request body required', 'BAD_REQUEST', 400)

    const { name, description, category, pricing_model, price_gbp, api_endpoint, documentation, tags } = body

    // Validate required fields
    if (!name?.trim()) return apiError('name is required', 'BAD_REQUEST', 400)
    if (!category?.trim()) return apiError('category is required', 'BAD_REQUEST', 400)

    const VALID_CATEGORIES = ['research', 'coding', 'data', 'marketing', 'support', 'legal', 'finance', 'writing', 'design', 'other']
    if (!VALID_CATEGORIES.includes(category)) {
      return apiError(`category must be one of: ${VALID_CATEGORIES.join(', ')}`, 'BAD_REQUEST', 400)
    }

    const VALID_PRICING_MODELS = ['per_use', 'subscription', 'one_time']
    const resolvedPricingModel = pricing_model || 'per_use'
    if (!VALID_PRICING_MODELS.includes(resolvedPricingModel)) {
      return apiError(`pricing_model must be one of: ${VALID_PRICING_MODELS.join(', ')}`, 'BAD_REQUEST', 400)
    }

    const priceNum = parseFloat(price_gbp)
    if (!price_gbp || isNaN(priceNum) || priceNum <= 0) {
      return apiError('price_gbp must be a positive number', 'BAD_REQUEST', 400)
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await supabase
      .from('skills')
      .insert({
        seller_id: auth.userId,
        name: name.trim(),
        description: description?.trim() || '',
        category,
        pricing_model: resolvedPricingModel,
        price_gbp: priceNum,
        api_endpoint: api_endpoint?.trim() || null,
        documentation: documentation?.trim() || null,
        tags: Array.isArray(tags) ? tags.filter((t: unknown) => typeof t === 'string').slice(0, 10) : [],
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      return apiError(error.message, 'DB_ERROR', 500)
    }

    // Analytics: skill listed
    await captureServerEvent(auth.userId, 'skill_listed', {
      skill_id: data.id,
      seller_id: auth.userId,
      category,
      pricing_model: resolvedPricingModel,
      price_gbp: priceNum,
    })

    return apiSuccess({
      skill_id: data.id,
      agent_card_url: `https://a2acolony.com/api/v1/skills/${data.id}/agent-card`,
      browse_url: `https://a2acolony.com/skill/${data.id}`,
      message: 'Skill listed successfully and is now live on the marketplace.',
    }, 201)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
