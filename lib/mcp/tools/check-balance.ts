import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { mcpError, requireAuth } from '../errors'
import { validateStoredApiKey } from '../auth'
import { BalanceResult } from '../types'

export function registerCheckBalance(server: McpServer) {
  server.tool(
    'check_balance',
    'Check your current wallet balance (requires authentication)',
    {},
    async () => {
      try {
        const auth = await validateStoredApiKey()
        if (!auth) return requireAuth()

        const supabase = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('credits_gbp')
          .eq('id', auth.userId)
          .single()

        if (error || !profile) {
          return mcpError('profile_not_found', 'Could not retrieve wallet balance')
        }

        const balance = parseFloat(profile.credits_gbp) || 0

        const result: BalanceResult = {
          balance_gbp: balance,
          message: `Your current wallet balance is £${balance.toFixed(2)} GBP`,
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
