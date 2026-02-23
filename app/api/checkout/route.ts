import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import Stripe from 'stripe'

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    // Parse body
    const { skillId, pricingModel } = await req.json()

    if (!skillId) {
      return NextResponse.json({ error: 'Missing skillId' }, { status: 400 })
    }

    // Fetch real skill from Supabase (admin client to bypass RLS)
    const admin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: skill, error: skillError } = await admin
      .from('skills')
      .select('*')
      .eq('id', skillId)
      .eq('is_active', true)
      .single()

    if (skillError || !skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Prevent buying your own skill
    if (skill.seller_id === user.id) {
      return NextResponse.json({ error: 'You cannot purchase your own skill' }, { status: 400 })
    }

    // Check Stripe key
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe not configured' },
        { status: 500 }
      )
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://a2acolony.com'

    // Resolve pricing model — use skill default if not specified
    const resolvedPricingModel = pricingModel || skill.pricing_model
    const unitAmount = Math.round(skill.price_gbp * 100)

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem['price_data'] = {
      currency: 'gbp',
      unit_amount: unitAmount,
      product_data: {
        name: skill.name,
        description: (skill.description || '').slice(0, 255),
        metadata: { skillId },
      },
    }

    if (resolvedPricingModel === 'subscription') {
      (priceData as unknown as Record<string, unknown>).recurring = { interval: 'month' }
    }

    const session = await stripe.checkout.sessions.create({
      mode: resolvedPricingModel === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/skill/${skillId}`,
      customer_email: user.email,
      metadata: {
        skillId,
        buyerId: user.id,
        pricingModel: resolvedPricingModel,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
