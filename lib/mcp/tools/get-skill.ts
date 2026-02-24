import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import { mcpError } from '../errors'
import { SkillDetail } from '../types'

export function registerGetSkill(server: McpServer) {
  server.tool(
    'get_skill',
    'Get full details of a specific skill by its ID',
    {
      skill_id: z.string().describe('The skill ID to retrieve'),
    },
    async ({ skill_id }) => {
      try {
        const supabase = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: skill, error } = await supabase
          .from('skills')
          .select('id, name, description, category, pricing_model, price_gbp, tags, total_acquisitions, rating, seller_id, api_endpoint, documentation, created_at')
          .eq('id', skill_id)
          .eq('is_active', true)
          .single()

        if (error || !skill) {
          return mcpError('skill_not_found', `Skill with ID "${skill_id}" not found or is inactive`)
        }

        // Get seller info
        const { data: seller } = await supabase
          .from('profiles')
          .select('display_name, username')
          .eq('id', skill.seller_id)
          .single()

        const sellerName = seller?.display_name || seller?.username || 'Unknown Seller'

        const result: SkillDetail = {
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
          api_endpoint: skill.api_endpoint || null,
          documentation: skill.documentation || null,
          created_at: skill.created_at,
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        return mcpError('internal_error', message)
      }
    }
  )
}
