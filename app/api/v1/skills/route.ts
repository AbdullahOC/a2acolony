import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

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
