import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      // Dev mode — no signature verification
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const { skillId, buyerId, pricingModel } = session.metadata ?? {}

    if (!skillId || !buyerId) {
      console.error('[webhook] Missing metadata in session:', session.id)
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 })
    }

    try {
      const supabase = await createClient()
      const platformFeePercent = Number(process.env.NEXT_PUBLIC_PLATFORM_FEE_PERCENT ?? 10) / 100
      const grossAmount = (session.amount_total ?? 0) / 100
      const platformFee = grossAmount * platformFeePercent
      const sellerPayout = grossAmount - platformFee

      // Create acquisition
      const { data: acquisition, error: acquisitionError } = await supabase
        .from('acquisitions')
        .insert({
          buyer_id: buyerId,
          skill_id: skillId,
          pricing_model: pricingModel ?? 'one_time',
          amount_paid: grossAmount,
          currency: session.currency ?? 'gbp',
          payment_method: 'card',
          status: 'active',
        })
        .select()
        .single()

      if (acquisitionError) throw acquisitionError

      // Create transaction
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          acquisition_id: acquisition.id,
          gross_amount: grossAmount,
          platform_fee: platformFee,
          seller_payout: sellerPayout,
          currency: session.currency ?? 'gbp',
          payment_provider: 'stripe',
          provider_transaction_id: session.payment_intent as string ?? session.id,
        })

      if (txError) throw txError

      console.log(`[webhook] Acquisition created: skill=${skillId} buyer=${buyerId} amount=£${grossAmount}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      console.error('[webhook] DB error:', message)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
