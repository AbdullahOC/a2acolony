import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { ethers } from 'ethers'
import { withFallback, ERC20_ABI, parseUsdc, usdcToGbp, fetchUsdcGbpRate } from '@/lib/crypto-wallet'

// Vercel cron calls this every 2 minutes
// GET /api/cron/crypto-scan

const USDC_ADDRESS = process.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const SCAN_BLOCK_RANGE = 100n // ~2 minutes of Base blocks (1s avg block time)
export async function GET() {
  // Endpoint is intentionally public — it only reads from the blockchain.
  // All credits are triggered by real on-chain transactions (unforgeable).
  // Idempotent: tx_hash UNIQUE constraint prevents double-crediting.

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results = { scanned_blocks: 0, deposits_found: 0, errors: [] as string[] }

  try {
    // Get all active deposit addresses
    const { data: depositAddresses, error: addrError } = await supabase
      .from('crypto_deposit_addresses')
      .select('user_id, address, network')
      .eq('network', 'base_usdc')

    if (addrError) throw new Error(`Failed to fetch deposit addresses: ${addrError.message}`)
    // Fetch live USDC/GBP rate once for this scan run
    const usdcGbpRate = await fetchUsdcGbpRate()
    console.log(`[crypto-scan] USDC/GBP rate: ${usdcGbpRate}`)

    if (!depositAddresses || depositAddresses.length === 0) {
      return NextResponse.json({ ...results, usdc_gbp_rate: usdcGbpRate, message: 'No deposit addresses yet' })
    }

    const addressSet = new Set(depositAddresses.map(a => a.address.toLowerCase()))
    const addressToUser = Object.fromEntries(
      depositAddresses.map(a => [a.address.toLowerCase(), a.user_id])
    )

    // Get last scanned block
    const { data: scanState } = await supabase
      .from('crypto_scan_state')
      .select('last_scanned_block')
      .eq('network', 'base_usdc')
      .single()

    const { currentBlock, events, effectiveFrom, toBlock } = await withFallback(async (provider) => {
      const currentBlock = BigInt(await provider.getBlockNumber())

      // Determine scan range
      let fromBlock: bigint
      if (!scanState || scanState.last_scanned_block === 0) {
        fromBlock = currentBlock - SCAN_BLOCK_RANGE
      } else {
        fromBlock = BigInt(scanState.last_scanned_block) + 1n
      }

      const toBlock = currentBlock
      const blockRange = toBlock - fromBlock
      const effectiveFrom = blockRange > 500n ? toBlock - 500n : fromBlock

      const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider)
      const transferFilter = usdc.filters.Transfer()
      const events = await usdc.queryFilter(transferFilter, Number(effectiveFrom), Number(toBlock))

      return { currentBlock, events, effectiveFrom, toBlock }
    })

    results.scanned_blocks = Number(toBlock - effectiveFrom)

    if (effectiveFrom > toBlock) {
      return NextResponse.json({ ...results, usdc_gbp_rate: usdcGbpRate, message: 'Already up to date' })
    }

    // Filter to only transfers TO our deposit addresses
    const relevant = events.filter(e => {
      const log = e as ethers.EventLog
      return log.args && addressSet.has((log.args[1] as string).toLowerCase())
    })

    for (const event of relevant) {
      const log = event as ethers.EventLog
      const toAddress = (log.args[1] as string).toLowerCase()
      const rawAmount = log.args[2] as bigint
      const txHash = event.transactionHash
      const blockNumber = event.blockNumber

      const usdcAmount = parseUsdc(rawAmount)
      const gbpAmount = usdcToGbp(usdcAmount, usdcGbpRate)
      const userId = addressToUser[toAddress]

      if (usdcAmount < 1) continue // Ignore dust (< 1 USDC)

      // Check if already processed
      const { data: existing } = await supabase
        .from('crypto_deposits')
        .select('id')
        .eq('tx_hash', txHash)
        .eq('network', 'base_usdc')
        .single()

      if (existing) continue // Already credited

      // Get sender address using fallback provider
      const fromAddress = await withFallback(async (p) => {
        const receipt = await p.getTransactionReceipt(txHash)
        return receipt?.from || null
      }).catch(() => null)

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
          from_address: fromAddress,
          to_address: toAddress,
          block_number: blockNumber,
          status: 'confirmed',
        })

      results.deposits_found++
      console.log(`[crypto-scan] Deposit: user=${userId} usdc=${usdcAmount} gbp=£${gbpAmount} tx=${txHash}`)
    }

    // Update scan state
    await supabase
      .from('crypto_scan_state')
      .update({
        last_scanned_block: Number(toBlock),
        last_scanned_at: new Date().toISOString(),
      })
      .eq('network', 'base_usdc')

    return NextResponse.json({
      ...results,
      from_block: Number(effectiveFrom),
      to_block: Number(toBlock),
      total_addresses_watched: depositAddresses.length,
      usdc_gbp_rate: usdcGbpRate,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[crypto-scan] Error:', message)
    return NextResponse.json({ ...results, error: message }, { status: 500 })
  }
}
