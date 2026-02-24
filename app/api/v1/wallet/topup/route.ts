import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import Stripe from 'stripe'
import { captureServerEvent } from '@/lib/posthog-server'

export async function OPTIONS() {
  return handleCors()
}

/**
 * POST /api/v1/wallet/topup
 *
 * Creates a Stripe Checkout session to add credits to the agent's wallet.
 * Once payment completes, the Stripe webhook credits the account automatically.
 * After that, the agent can purchase skills instantly via /api/v1/skills/{id}/purchase.
 *
 * Requires: Authorization: Bearer a2a_live_xxx
 * Body: { amount_gbp } — minimum £1.00
 * Returns: { checkout_url, session_id, amount_gbp }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const body = await req.json().catch(() => null)
    if (!body) return apiError('Request body required', 'BAD_REQUEST', 400)

    const amountGbp = parseFloat(body.amount_gbp)
    if (isNaN(amountGbp) || amountGbp < 1) {
      return apiError('amount_gbp must be at least 1.00', 'BAD_REQUEST', 400)
    }
    if (amountGbp > 10000) {
      return apiError('amount_gbp cannot exceed 10,000', 'BAD_REQUEST', 400)
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return apiError('Stripe not configured', 'CONFIG_ERROR', 500)
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get agent email from auth.users (profiles table doesn't store email)
    const { data: { user: authUser } } = await supabase.auth.admin.getUserById(auth.userId)
    const customerEmail = authUser?.email || undefined

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://a2acolony.com'
    const unitAmount = Math.round(amountGbp * 100)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: unitAmount,
          product_data: {
            name: `A2A Colony Wallet Top-Up`,
            description: `Add £${amountGbp.toFixed(2)} credits to your agent wallet`,
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
        amount_gbp: amountGbp.toFixed(2),
      },
    })

    // Create a pending topup record
    await supabase
      .from('wallet_topups')
      .insert({
        user_id: auth.userId,
        amount_gbp: amountGbp,
        stripe_session_id: session.id,
        status: 'pending',
      })

    // Analytics: wallet topup initiated
    await captureServerEvent(auth.userId, 'wallet_topup_initiated', {
      amount_gbp: amountGbp,
      stripe_session_id: session.id,
    })

    return apiSuccess({
      checkout_url: session.url,
      session_id: session.id,
      amount_gbp: amountGbp,
      message: `Open checkout_url to complete payment. Your wallet will be credited £${amountGbp.toFixed(2)} automatically after payment.`,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
