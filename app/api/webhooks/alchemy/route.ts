import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { parseUsdc, usdcToGbp, fetchUsdcGbpRate } from '@/lib/crypto-wallet'
import { createHmac } from 'crypto'

// Alchemy Address Activity webhook handler
// Fires instantly when USDC is transferred to any watched address on Base
// POST /api/webhooks/alchemy

const USDC_ADDRESS = (process.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913').toLowerCase()

/**
 * Verify Alchemy webhook signature.
 * Alchemy signs payloads with HMAC-SHA256 using the webhook signing key.
 */
function verifyAlchemySignature(body: string, signature: string, signingKey: string): boolean {
  const hmac = createHmac('sha256', signingKey)
  hmac.update(body)
  const digest = hmac.digest('hex')
  return digest === signature
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-alchemy-signature') || ''
  const signingKey = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY

  // Verify signature if key is configured
  if (signingKey) {
    if (!signature || !verifyAlchemySignature(rawBody, signature, signingKey)) {
      console.error('[alchemy-webhook] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: AlchemyWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Only handle ADDRESS_ACTIVITY events
  if (payload.type !== 'ADDRESS_ACTIVITY') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const activity = payload.event?.activity || []
  const results = { processed: 0, credited: 0, skipped: 0, errors: [] as string[] }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all watched deposit addresses for quick lookup
  const { data: depositAddresses } = await supabase
    .from('crypto_deposit_addresses')
    .select('user_id, address, network')
    .eq('network', 'base_usdc')

  if (!depositAddresses || depositAddresses.length === 0) {
    return NextResponse.json({ ...results, message: 'No deposit addresses configured' })
  }

  const addressToUser: Record<string, string> = Object.fromEntries(
    depositAddresses.map(a => [a.address.toLowerCase(), a.user_id])
  )

  const usdcGbpRate = await fetchUsdcGbpRate()

  for (const item of activity) {
    results.processed++

    // Only process USDC token transfers to our watched addresses
    const toAddr = item.toAddress?.toLowerCase()
    const contractAddr = item.rawContract?.address?.toLowerCase()

    if (
      item.category !== 'token' ||
      contractAddr !== USDC_ADDRESS ||
      !toAddr ||
      !addressToUser[toAddr]
    ) {
      results.skipped++
      continue
    }

    const userId = addressToUser[toAddr]
    const txHash = item.hash
    const blockNumber = parseInt(item.blockNum, 16)

    // Parse USDC amount from raw hex value
    const rawValue = item.rawContract?.rawValue
    let usdcAmount: number
    try {
      usdcAmount = parseUsdc(BigInt(rawValue))
    } catch {
      // Fallback to value field (Alchemy sometimes provides float for tokens)
      usdcAmount = typeof item.value === 'number' ? item.value : 0
    }

    if (usdcAmount < 1) {
      results.skipped++
      continue // Ignore dust
    }

    const gbpAmount = usdcToGbp(usdcAmount, usdcGbpRate)

    // Check if already processed (idempotent)
    const { data: existing } = await supabase
      .from('crypto_deposits')
      .select('id')
      .eq('tx_hash', txHash)
      .eq('network', 'base_usdc')
      .single()

    if (existing) {
      results.skipped++
      continue
    }

    try {
      // Credit user wallet
      const { data: profile } = await supabase
        .from('profiles')
        .select('credits_gbp')
        .eq('id', userId)
        .single()

      const currentBalance = parseFloat(profile?.credits_gbp ?? '0') || 0
      const newBalance = currentBalance + gbpAmount

      await supabase
        .from('profiles')
        .update({ credits_gbp: newBalance })
        .eq('id', userId)

      // Record deposit
      await supabase
        .from('crypto_deposits')
        .insert({
          user_id: userId,
          network: 'base_usdc',
          tx_hash: txHash,
          amount_usdc: usdcAmount,
          amount_gbp: gbpAmount,
          from_address: item.fromAddress?.toLowerCase() || null,
          to_address: toAddr,
          block_number: blockNumber,
          status: 'confirmed',
        })

      results.credited++
      console.log(`[alchemy-webhook] Deposit credited: user=${userId} usdc=${usdcAmount} gbp=£${gbpAmount} tx=${txHash}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      results.errors.push(`tx=${txHash}: ${msg}`)
      console.error('[alchemy-webhook] Error crediting deposit:', msg)
    }
  }

  return NextResponse.json({
    ok: true,
    usdc_gbp_rate: usdcGbpRate,
    ...results,
  })
}

// Alchemy webhook payload types
interface AlchemyActivity {
  fromAddress: string
  toAddress: string
  blockNum: string
  hash: string
  value: number
  asset: string
  category: string
  rawContract: {
    rawValue: string
    address: string
    decimal: number
  }
}

interface AlchemyWebhookPayload {
  webhookId: string
  id: string
  createdAt: string
  type: string
  event: {
    network: string
    activity: AlchemyActivity[]
  }
}
