import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import { mcpError, requireAuth } from '../errors'
import { validateStoredApiKey } from '../auth'
import { PurchaseResult } from '../types'

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

        // Fetch skill
        const { data: skill, error: skillError } = await supabase
          .from('skills')
          .select('*')
          .eq('id', skill_id)
          .eq('is_active', true)
          .single()

        if (skillError || !skill) {
          return mcpError('skill_not_found', `Skill with ID "${skill_id}" not found or is inactive`)
        }

        // Prevent self-purchase
        if (skill.seller_id === auth.userId) {
          return mcpError('self_purchase', 'You cannot purchase your own skill')
        }

        // Check for existing active acquisition
        const { data: existing } = await supabase
          .from('acquisitions')
          .select('id')
          .eq('buyer_id', auth.userId)
          .eq('skill_id', skill_id)
          .eq('status', 'active')
          .single()

        if (existing) {
          return mcpError('already_owned', 'You already own this skill', { skill_id })
        }

        // Fetch buyer's wallet balance
        const { data: buyerProfile, error: profileError } = await supabase
          .from('profiles')
          .select('credits_gbp, commission_rate')
          .eq('id', auth.userId)
          .single()

        if (profileError || !buyerProfile) {
          return mcpError('profile_error', 'Could not retrieve wallet balance')
        }

        const balance = parseFloat(buyerProfile.credits_gbp) || 0
        const price = parseFloat(skill.price_gbp)

        if (balance < price) {
          return mcpError('insufficient_funds', `Insufficient credits. Balance: £${balance.toFixed(2)}, Required: £${price.toFixed(2)}. Use topup_wallet to add credits.`, {
            balance_gbp: balance,
            required_gbp: price,
          })
        }

        // 1. Deduct from buyer wallet (optimistic lock)
        const { error: deductError } = await supabase
          .from('profiles')
          .update({ credits_gbp: balance - price })
          .eq('id', auth.userId)
          .eq('credits_gbp', balance)

        if (deductError) {
          return mcpError('payment_failed', 'Payment failed — balance may have changed, please try again')
        }

        // 2. Get seller commission rate
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('commission_rate, total_earned')
          .eq('id', skill.seller_id)
          .single()

        const commissionRate = sellerProfile?.commission_rate ?? 25
        const platformFee = price * (commissionRate / 100)
        const sellerPayout = price - platformFee

        // 3. Create acquisition record
        const { data: acquisition, error: acqError } = await supabase
          .from('acquisitions')
          .insert({
            buyer_id: auth.userId,
            skill_id,
            pricing_model: skill.pricing_model,
            amount_paid: price,
            currency: 'gbp',
            payment_method: 'credits',
            status: 'active',
          })
          .select('id')
          .single()

        if (acqError) {
          // Rollback wallet deduction
          await supabase
            .from('profiles')
            .update({ credits_gbp: balance })
            .eq('id', auth.userId)
          return mcpError('db_error', 'Failed to create acquisition record')
        }

        // 4. Create transaction record
        await supabase
          .from('transactions')
          .insert({
            acquisition_id: acquisition.id,
            seller_id: skill.seller_id,
            skill_id,
            gross_amount: price,
            platform_fee: platformFee,
            seller_payout: sellerPayout,
            commission_rate: commissionRate,
            currency: 'gbp',
            payment_provider: 'credits',
            provider_transaction_id: acquisition.id,
            status: 'completed',
          })

        // 5. Credit seller earnings
        const currentEarned = parseFloat(sellerProfile?.total_earned ?? '0') || 0
        await supabase
          .from('profiles')
          .update({ total_earned: currentEarned + sellerPayout })
          .eq('id', skill.seller_id)

        // 6. Increment skill acquisition counter
        const { data: currentSkill } = await supabase
          .from('skills')
          .select('total_acquisitions')
          .eq('id', skill_id)
          .single()
        await supabase
          .from('skills')
          .update({ total_acquisitions: (currentSkill?.total_acquisitions ?? 0) + 1 })
          .eq('id', skill_id)

        const result: PurchaseResult = {
          acquisition_id: acquisition.id,
          skill_id,
          skill_name: skill.name,
          amount_charged_gbp: price,
          credits_remaining_gbp: balance - price,
          message: `Successfully purchased "${skill.name}". Use access_skill to get integration details.`,
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
