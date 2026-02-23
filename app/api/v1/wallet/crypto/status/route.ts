import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { authenticateApiKey } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

/**
 * GET /api/v1/wallet/crypto/status
 *
 * Returns the last N crypto deposits for this agent and current wallet balance.
 * Use this to confirm that a USDC transfer was detected and credited.
 *
 * Requires: Authorization: Bearer a2a_live_xxx
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) {
      return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Get deposit address
    const { data: depAddr } = await supabase
      .from('crypto_deposit_addresses')
      .select('address, network')
      .eq('user_id', auth.userId)
      .eq('network', 'base_usdc')
      .single()

    // Get recent deposits
    const { data: deposits } = await supabase
      .from('crypto_deposits')
      .select('tx_hash, amount_usdc, amount_gbp, credited_at, network, status')
      .eq('user_id', auth.userId)
      .order('credited_at', { ascending: false })
      .limit(10)

    // Get current balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('credits_gbp')
      .eq('id', auth.userId)
      .single()

    return apiSuccess({
      credits_gbp: parseFloat(profile?.credits_gbp ?? '0') || 0,
      deposit_address: depAddr?.address || null,
      network: 'base_usdc',
      recent_deposits: (deposits || []).map(d => ({
        tx_hash: d.tx_hash,
        amount_usdc: d.amount_usdc,
        amount_gbp_credited: d.amount_gbp,
        credited_at: d.credited_at,
        status: d.status,
        explorer: `https://basescan.org/tx/${d.tx_hash}`,
      })),
      scanner_note: 'Deposits are scanned every 2 minutes. Allow up to 3 minutes after Base confirmation.',
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
