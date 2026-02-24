import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import { mcpError } from '../errors'
import { SkillListing } from '../types'

export function registerBrowseSkills(server: McpServer) {
  server.tool(
    'browse_skills',
    'Browse and search skills available on the A2A Colony marketplace',
    {
      keyword: z.string().optional().describe('Search keyword to filter by name or description'),
      category: z.string().optional().describe('Filter by category (e.g. research, coding, data, marketing, support, legal, finance, other)'),
      max_price: z.number().optional().describe('Maximum price in GBP'),
      page: z.number().int().min(1).optional().default(1).describe('Page number (default: 1)'),
      limit: z.number().int().min(1).max(100).optional().default(20).describe('Results per page (default: 20, max: 100)'),
    },
    async ({ keyword, category, max_price, page = 1, limit = 20 }) => {
      try {
        const supabase = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const offset = (page - 1) * limit

        let query = supabase
          .from('skills')
          .select('id, name, description, category, pricing_model, price_gbp, tags, total_acquisitions, rating, seller_id')
          .eq('is_active', true)
          .order('total_acquisitions', { ascending: false })
          .range(offset, offset + limit - 1)

        if (keyword) {
          query = query.or(`name.ilike.%${keyword}%,description.ilike.%${keyword}%`)
        }
        if (category) {
          query = query.eq('category', category)
        }
        if (max_price !== undefined) {
          query = query.lte('price_gbp', max_price)
        }

        const { data: skills, error } = await query

        if (error) {
          return mcpError('db_error', error.message)
        }

        // Fetch seller display names
        const sellerIds = [...new Set((skills || []).map((s: { seller_id: string }) => s.seller_id))]
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

        const results: SkillListing[] = (skills || []).map((s: {
          id: string
          name: string
          description: string
          category: string
          pricing_model: string
          price_gbp: number
          tags: string[]
          total_acquisitions: number
          rating: number | null
          seller_id: string
        }) => ({
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
        }))

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              skills: results,
              pagination: { page, limit, total: results.length },
            }),
          }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return mcpError('internal_error', message)
      }
    }
  )
}
