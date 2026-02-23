import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { deriveAddress } from '@/lib/crypto-wallet'

export async function OPTIONS() {
  return handleCors()
}

/**
 * GET /api/v1/wallet/crypto/address?network=base_usdc
 *
 * Returns the agent's unique USDC deposit address on Base.
 * Address is deterministically derived from the master HD wallet.
 * Send USDC to this address — wallet is credited automatically within ~2 minutes.
 *
 * Requires: Authorization: Bearer a2a_live_xxx
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const network = new URL(req.url).searchParams.get('network') || 'base_usdc'
    const SUPPORTED_NETWORKS = ['base_usdc']
    if (!SUPPORTED_NETWORKS.includes(network)) {
      return apiError(`Unsupported network. Supported: ${SUPPORTED_NETWORKS.join(', ')}`, 'BAD_REQUEST', 400)
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Check if address already assigned
    const { data: existing } = await supabase
      .from('crypto_deposit_addresses')
      .select('address, address_index')
      .eq('user_id', auth.userId)
      .eq('network', network)
      .single()

    if (existing) {
      return apiSuccess({
        address: existing.address,
        network,
        token: 'USDC',
        chain: 'Base (Chain ID: 8453)',
        min_deposit: 1,
        note: 'Send USDC on the Base network only. Your wallet is credited automatically within ~2 minutes of confirmation.',
        contract: process.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        check_status: 'GET /api/v1/wallet/crypto/status',
      })
    }

    // Assign a new index — find the next available
    const { data: maxIndexRow } = await supabase
      .from('crypto_deposit_addresses')
      .select('address_index')
      .eq('network', network)
      .order('address_index', { ascending: false })
      .limit(1)
      .single()

    const nextIndex = (maxIndexRow?.address_index ?? -1) + 1
    const address = deriveAddress(nextIndex)

    // Save the assignment
    const { error: insertError } = await supabase
      .from('crypto_deposit_addresses')
      .insert({
        user_id: auth.userId,
        network,
        address,
        address_index: nextIndex,
      })

    if (insertError) {
      return apiError('Failed to assign deposit address', 'DB_ERROR', 500)
    }

    return apiSuccess({
      address,
      network,
      token: 'USDC',
      chain: 'Base (Chain ID: 8453)',
      min_deposit: 1,
      note: 'Send USDC on the Base network only. Your wallet is credited automatically within ~2 minutes of confirmation.',
      contract: process.env.USDC_BASE_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      check_status: 'GET /api/v1/wallet/crypto/status',
    }, 201)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
