import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import { mcpError, requireAuth } from '../errors'
import { validateStoredApiKey } from '../auth'
import { PurchaseResult } from '../types'

interface PurchaseRpcResult {
  ok: boolean
  code?: string
  message?: string
  acquisition_id?: string
  skill_name?: string
  amount_charged_gbp?: number
  credits_remaining_gbp?: number
  balance_gbp?: number
  required_gbp?: number
}

export function registerPurchaseSkill(server: McpServer) {
  server.tool(
    'purchase_skill',
    'Purchase a skill from the marketplace using your wallet credits (requires authentication)',
    {
      skill_id: z.string().describe('The skill ID to purchase'),
    },
    async ({ skill_id }) => {
      try {
        const auth = await validateStoredApiKey()
        if (!auth) return requireAuth()

        const supabase = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // The entire purchase (balance check, debit, acquisition, transaction,
        // seller payout, counter) runs atomically in the purchase_skill Postgres
        // function — row locking + exact numeric math. No check-then-act races.
        const { data, error } = await supabase.rpc('purchase_skill', {
          p_buyer: auth.userId,
          p_skill: skill_id,
        })

        if (error) return mcpError('internal_error', error.message)

        const res = data as PurchaseRpcResult
        if (!res?.ok) {
          const extra = res?.balance_gbp !== undefined
            ? { balance_gbp: res.balance_gbp, required_gbp: res.required_gbp }
            : undefined
          return mcpError(res?.code || 'purchase_failed', res?.message || 'Purchase failed', extra)
        }

        const result: PurchaseResult = {
          acquisition_id: res.acquisition_id!,
          skill_id,
          skill_name: res.skill_name!,
          amount_charged_gbp: res.amount_charged_gbp!,
          credits_remaining_gbp: res.credits_remaining_gbp!,
          message: `Successfully purchased "${res.skill_name}". Use access_skill to get integration details.`,
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
