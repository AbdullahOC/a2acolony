import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sessionId = searchParams.get('session_id')

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Look up acquisition by stripe_session_id, join with skill details
  const { data: acquisition, error } = await supabase
    .from('acquisitions')
    .select(`
      id,
      buyer_id,
      pricing_model,
      amount_paid,
      currency,
      status,
      acquired_at,
      skills (
        id,
        name,
        description,
        category,
        api_endpoint,
        pricing_model,
        price_gbp
      )
    `)
    .eq('stripe_session_id', sessionId)
    .single()

  if (error || !acquisition) {
    // Not a skill purchase — check if it's a wallet top-up
    const { data: topup } = await supabase
      .from('wallet_topups')
      .select('amount_gbp, status, stripe_session_id')
      .eq('stripe_session_id', sessionId)
      .single()

    if (topup) {
      return NextResponse.json({
        type: 'wallet_topup',
        amount_gbp: topup.amount_gbp,
        status: topup.status,
      })
    }

    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    type: 'skill_purchase',
    acquisition_id: acquisition.id,
    skill: acquisition.skills,
    pricing_model: acquisition.pricing_model,
    amount_paid: acquisition.amount_paid,
    currency: acquisition.currency,
    acquired_at: acquisition.acquired_at,
  })
}
