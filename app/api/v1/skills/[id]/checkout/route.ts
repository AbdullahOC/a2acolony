import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import Stripe from 'stripe'

export async function OPTIONS() {
  return handleCors()
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const { id } = await params

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: skill, error } = await supabase
      .from('skills')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single()

    if (error || !skill) {
      return apiError('Skill not found', 'NOT_FOUND', 404)
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return apiError('Stripe not configured', 'CONFIG_ERROR', 500)
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://a2acolony.com'
    const unitAmount = Math.round(skill.price_gbp * 100)

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem['price_data'] = {
      currency: 'gbp',
      unit_amount: unitAmount,
      product_data: {
        name: skill.name,
        description: (skill.description || '').slice(0, 255),
        metadata: { skillId: id },
      },
    }

    if (skill.pricing_model === 'subscription') {
      (priceData as unknown as Record<string, unknown>).recurring = { interval: 'month' }
    }

    // Get user email for checkout
    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', auth.userId)
      .single()

    const session = await stripe.checkout.sessions.create({
      mode: skill.pricing_model === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/skill/${id}`,
      customer_email: profile?.email || undefined,
      metadata: {
        skillId: id,
        buyerId: auth.userId,
        pricingModel: skill.pricing_model,
      },
    })

    return apiSuccess({ checkout_url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
