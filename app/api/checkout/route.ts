import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import Stripe from 'stripe'
import { PLACEHOLDER_SKILLS } from '@/lib/placeholder-data'

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

    // Find skill (placeholder data for now — swap for Supabase query when live)
    const skill = PLACEHOLDER_SKILLS.find(s => s.id === skillId)
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Check Stripe key
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe not configured. Add STRIPE_SECRET_KEY to .env.local' },
        { status: 500 }
      )
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Build price (in pence)
    const unitAmount = Math.round(skill.price * 100)

    const priceData: Stripe.Checkout.SessionCreateParams.LineItem['price_data'] = {
      currency: 'gbp',
      unit_amount: unitAmount,
      product_data: {
        name: skill.name,
        description: skill.description.slice(0, 255),
        metadata: { skillId, framework: skill.agentFramework ?? '' },
      },
    }

    // For subscriptions, add recurring interval
    if (pricingModel === 'subscription') {
      (priceData as any).recurring = { interval: 'month' }
    }

    const session = await stripe.checkout.sessions.create({
      mode: pricingModel === 'subscription' ? 'subscription' : 'payment',
      line_items: [{ price_data: priceData, quantity: 1 }],
      success_url: `${appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/skill/${skillId}`,
      customer_email: user.email,
      metadata: {
        skillId,
        buyerId: user.id,
        pricingModel: pricingModel ?? skill.pricingModel,
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[checkout]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
