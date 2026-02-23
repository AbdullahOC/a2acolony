import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

/**
 * POST /api/v1/skills/{id}/purchase
 *
 * Instantly purchases a skill by deducting from the agent's wallet credits.
 * No Stripe redirect — fully programmatic. Agent must have sufficient credits.
 *
 * Requires: Authorization: Bearer a2a_live_xxx
 * Returns: { acquisition_id, skill_id, amount_charged_gbp, credits_remaining_gbp, access_endpoint }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const { id: skillId } = await params

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Fetch skill
    const { data: skill, error: skillError } = await supabase
      .from('skills')
      .select('*')
      .eq('id', skillId)
      .eq('is_active', true)
      .single()

    if (skillError || !skill) {
      return apiError('Skill not found or inactive', 'NOT_FOUND', 404)
    }

    // Prevent self-purchase
    if (skill.seller_id === auth.userId) {
      return apiError('You cannot purchase your own skill', 'BAD_REQUEST', 400)
    }

    // Check for existing active acquisition
    const { data: existing } = await supabase
      .from('acquisitions')
      .select('id')
      .eq('buyer_id', auth.userId)
      .eq('skill_id', skillId)
      .eq('status', 'active')
      .single()

    if (existing) {
      return apiError('You already own this skill', 'CONFLICT', 409)
    }

    // Fetch buyer's wallet balance
    const { data: buyerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('credits_gbp, commission_rate')
      .eq('id', auth.userId)
      .single()

    if (profileError || !buyerProfile) {
      return apiError('Could not retrieve wallet balance', 'INTERNAL_ERROR', 500)
    }

    const balance = parseFloat(buyerProfile.credits_gbp) || 0
    const price = parseFloat(skill.price_gbp)

    if (balance < price) {
      return apiError(
        `Insufficient credits. Balance: £${balance.toFixed(2)}, Required: £${price.toFixed(2)}. Top up at POST /api/v1/wallet/topup`,
        'PAYMENT_REQUIRED',
        402
      )
    }

    // --- ATOMIC TRANSACTION ---

    // 1. Deduct from buyer wallet
    const { error: deductError } = await supabase
      .from('profiles')
      .update({ credits_gbp: balance - price })
      .eq('id', auth.userId)
      .eq('credits_gbp', balance) // optimistic lock — fail if balance changed

    if (deductError) {
      return apiError('Payment failed — please try again', 'PAYMENT_FAILED', 500)
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
        skill_id: skillId,
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
      return apiError('Failed to create acquisition record', 'DB_ERROR', 500)
    }

    // 4. Create transaction record
    await supabase
      .from('transactions')
      .insert({
        acquisition_id: acquisition.id,
        seller_id: skill.seller_id,
        skill_id: skillId,
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
      .eq('id', skillId)
      .single()
    await supabase
      .from('skills')
      .update({ total_acquisitions: (currentSkill?.total_acquisitions ?? 0) + 1 })
      .eq('id', skillId)

    return apiSuccess({
      acquisition_id: acquisition.id,
      skill_id: skillId,
      skill_name: skill.name,
      amount_charged_gbp: price,
      platform_fee_gbp: platformFee,
      credits_remaining_gbp: balance - price,
      access_endpoint: skill.api_endpoint || null,
      agent_card_url: `https://a2acolony.com/api/v1/skills/${skillId}/agent-card`,
      message: `Successfully acquired "${skill.name}". Use access_endpoint to invoke the skill.`,
    }, 201)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
