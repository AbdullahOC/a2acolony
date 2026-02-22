import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@/lib/supabase-server'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
})

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event: Stripe.Event

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } else {
      event = JSON.parse(body) as Stripe.Event
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[webhook] Signature verification failed:', message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (event.type) {

      // ─────────────────────────────────────────────────────
      // SKILL PURCHASE — one-time / per-use acquisition
      // ─────────────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        // Only handle skill purchases (not subscription checkouts)
        if (session.mode === 'subscription') break

        const { skillId, buyerId, pricingModel } = session.metadata ?? {}
        if (!skillId || !buyerId) {
          console.error('[webhook] Missing skill metadata in session:', session.id)
          break
        }

        // Get the skill to find the seller
        const { data: skill } = await supabase
          .from('skills')
          .select('id, seller_id, price_gbp')
          .eq('id', skillId)
          .single()

        if (!skill) {
          console.error('[webhook] Skill not found:', skillId)
          break
        }

        // Get seller's current commission rate
        const { data: seller } = await supabase
          .from('profiles')
          .select('commission_rate')
          .eq('id', skill.seller_id)
          .single()

        const commissionRate = seller?.commission_rate ?? 25.00
        const grossAmount = (session.amount_total ?? 0) / 100
        const platformFee = grossAmount * (commissionRate / 100)
        const sellerPayout = grossAmount - platformFee

        // Create acquisition record
        const { data: acquisition, error: acqErr } = await supabase
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

        if (acqErr) throw acqErr

        // Create transaction with full seller tracking
        const { error: txErr } = await supabase
          .from('transactions')
          .insert({
            acquisition_id: acquisition.id,
            seller_id: skill.seller_id,
            skill_id: skillId,
            gross_amount: grossAmount,
            platform_fee: platformFee,
            seller_payout: sellerPayout,
            commission_rate: commissionRate,
            currency: session.currency ?? 'gbp',
            payment_provider: 'stripe',
            stripe_payment_intent_id: session.payment_intent as string,
            provider_transaction_id: session.payment_intent as string ?? session.id,
            status: 'pending',
          })

        if (txErr) throw txErr

        // Update seller's running totals
        await supabase.rpc('increment_seller_earnings', {
          p_seller_id: skill.seller_id,
          p_amount: sellerPayout,
        })

        // Increment skill acquisition count
        await supabase
          .from('skills')
          .update({ total_acquisitions: skill.price_gbp })
          .eq('id', skillId)

        console.log(`[webhook] Skill sale: skill=${skillId} seller=${skill.seller_id} gross=£${grossAmount} payout=£${sellerPayout} rate=${commissionRate}%`)
        break
      }

      // ─────────────────────────────────────────────────────
      // SUBSCRIPTION ACTIVATED
      // ─────────────────────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id

        if (!userId) {
          console.error('[webhook] No user_id in subscription metadata:', subscription.id)
          break
        }

        const isActive = subscription.status === 'active' || subscription.status === 'trialing'

        const { error } = await supabase
          .from('profiles')
          .update({
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            subscription_tier: isActive ? 'subscribed' : 'free',
            subscription_status: subscription.status,
            subscription_started_at: isActive
              ? new Date(subscription.start_date * 1000).toISOString()
              : undefined,
            subscription_ends_at: subscription.cancel_at
              ? new Date(subscription.cancel_at * 1000).toISOString()
              : undefined,
            // commission_rate auto-updated by DB trigger
          })
          .eq('id', userId)

        if (error) throw error

        console.log(`[webhook] Subscription ${event.type}: user=${userId} status=${subscription.status} tier=${isActive ? 'subscribed' : 'free'}`)
        break
      }

      // ─────────────────────────────────────────────────────
      // SUBSCRIPTION CANCELLED / ENDED
      // ─────────────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id

        if (!userId) break

        const { error } = await supabase
          .from('profiles')
          .update({
            subscription_tier: 'free',
            subscription_status: 'cancelled',
            stripe_subscription_id: null,
            subscription_ends_at: new Date().toISOString(),
            // commission_rate auto-updated by DB trigger back to 25%
          })
          .eq('id', userId)

        if (error) throw error

        console.log(`[webhook] Subscription cancelled: user=${userId} — reverted to 25% commission`)
        break
      }

      // ─────────────────────────────────────────────────────
      // PAYMENT FAILED — flag the subscription
      // ─────────────────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = (invoice as Record<string, unknown>).subscription as string

        if (!subscriptionId) break

        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('stripe_subscription_id', subscriptionId)
          .single()

        if (profile) {
          await supabase
            .from('profiles')
            .update({ subscription_status: 'past_due' })
            .eq('id', profile.id)

          console.log(`[webhook] Payment failed: subscription=${subscriptionId} user=${profile.id} → past_due`)
        }
        break
      }

      default:
        console.log(`[webhook] Unhandled event type: ${event.type}`)
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[webhook] Error handling ${event.type}:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
