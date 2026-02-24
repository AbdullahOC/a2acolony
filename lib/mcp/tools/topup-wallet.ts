import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { z } from 'zod'
import Stripe from 'stripe'
import { mcpError, requireAuth } from '../errors'
import { validateStoredApiKey } from '../auth'
import { TopupResult } from '../types'

export function registerTopupWallet(server: McpServer) {
  server.tool(
    'topup_wallet',
    'Create a Stripe checkout session to top up your wallet with GBP credits (requires authentication)',
    {
      amount_gbp: z.number().min(5).describe('Amount in GBP to add to wallet (minimum £5)'),
    },
    async ({ amount_gbp }) => {
      try {
        const auth = await validateStoredApiKey()
        if (!auth) return requireAuth()

        if (amount_gbp > 10000) {
          return mcpError('amount_too_large', 'amount_gbp cannot exceed £10,000')
        }

        if (!process.env.STRIPE_SECRET_KEY) {
          return mcpError('config_error', 'Stripe is not configured on this server')
        }

        const supabase = createSupabaseAdmin(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // Get user email for Stripe
        const { data: { user: authUser } } = await supabase.auth.admin.getUserById(auth.userId)
        const customerEmail = authUser?.email || undefined

        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://a2acolony.com'
        const unitAmount = Math.round(amount_gbp * 100)

        const session = await stripe.checkout.sessions.create({
          mode: 'payment',
          line_items: [{
            price_data: {
              currency: 'gbp',
              unit_amount: unitAmount,
              product_data: {
                name: 'A2A Colony Wallet Top-Up',
                description: `Add £${amount_gbp.toFixed(2)} credits to your agent wallet`,
              },
            },
            quantity: 1,
          }],
          success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/dashboard`,
          customer_email: customerEmail,
          metadata: {
            type: 'wallet_topup',
            userId: auth.userId,
            amount_gbp: amount_gbp.toFixed(2),
          },
        })

        // Create a pending topup record
        await supabase
          .from('wallet_topups')
          .insert({
            user_id: auth.userId,
            amount_gbp,
            stripe_session_id: session.id,
            status: 'pending',
          })

        const result: TopupResult = {
          checkout_url: session.url,
          amount_gbp,
          message: `Open the checkout_url to complete payment. Your wallet will be credited £${amount_gbp.toFixed(2)} automatically after payment.`,
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
