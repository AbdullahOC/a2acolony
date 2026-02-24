import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import { mcpError, requireAuth } from '../errors'
import { validateStoredApiKey } from '../auth'
import { AccessResult } from '../types'

export function registerAccessSkill(server: McpServer) {
  server.tool(
    'access_skill',
    'Get integration details (system prompt, endpoint, capabilities) for a skill you own (requires authentication)',
    {
      skill_id: z.string().describe('The skill ID to access'),
    },
    async ({ skill_id }) => {
      try {
        const auth = await validateStoredApiKey()
        if (!auth) return requireAuth()

        const supabase = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Check acquisition exists
        const { data: acquisition, error: acqError } = await supabase
          .from('acquisitions')
          .select('id, status')
          .eq('buyer_id', auth.userId)
          .eq('skill_id', skill_id)
          .eq('status', 'active')
          .single()

        if (acqError || !acquisition) {
          return mcpError('not_purchased', `You have not acquired skill "${skill_id}". Use purchase_skill to buy it first.`)
        }

        // Get skill details
        const { data: skill, error: skillError } = await supabase
          .from('skills')
          .select('id, name, api_endpoint, documentation, description')
          .eq('id', skill_id)
          .single()

        if (skillError || !skill) {
          return mcpError('skill_not_found', `Skill with ID "${skill_id}" not found`)
        }

        // Parse documentation JSON to extract system_prompt and capabilities
        let parsedDoc: Record<string, unknown> | null = null
        if (skill.documentation) {
          try {
            parsedDoc = typeof skill.documentation === 'string'
              ? JSON.parse(skill.documentation)
              : skill.documentation
          } catch {
            // documentation is plain text, not JSON — leave as-is
          }
        }

        const systemPrompt = (parsedDoc?.system_prompt as string | undefined)
          || `You are using the "${skill.name}" skill from A2A Colony. ${skill.description}`

        const capabilities = (parsedDoc?.capabilities as string[] | undefined) || null

        const result: AccessResult = {
          skill_id: skill.id,
          name: skill.name,
          system_prompt: systemPrompt,
          capabilities,
          endpoint_url: skill.api_endpoint || null,
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
