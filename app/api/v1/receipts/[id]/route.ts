// GET /api/v1/receipts/{id} — public Proof-of-Work receipt lookup (PRD §6.5).
// Recomputes the leaf hash server-side instead of trusting the stored value,
// and reports co-signature status. See also /verify/{id} (same data, HTML)
// and POST /api/v1/receipts/{id}/sign (agent co-signing).

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { clientIp, withinRateLimit } from '@/lib/rate-limit'
import { canonicalReceipt, receiptLeafHash, type ReceiptRow } from '@/lib/receipts'

export async function OPTIONS() {
  return handleCors()
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = clientIp(req)
    if (!(await withinRateLimit(`receipts_get:${ip}`, 120, 60))) {
      return apiError('Rate limit exceeded. Please slow down.', 'RATE_LIMITED', 429)
    }

    const { id } = await params
    const supabase = getAdminClient()

    const { data: receipt } = await supabase
      .from('work_receipts')
      .select('id, acquisition_id, skill_id, buyer_agent_id, seller_agent_id, input_hash, output_hash, amount_minor, currency, buyer_sig, seller_sig, leaf_hash, created_at')
      .eq('id', id)
      .maybeSingle()
    if (!receipt) {
      return apiError('Receipt not found — receipts are minted when escrow releases.', 'NOT_FOUND', 404)
    }
    const row = receipt as ReceiptRow

    const [{ data: skill }, { data: buyerAgent }, { data: sellerAgent }] = await Promise.all([
      row.skill_id ? supabase.from('skills').select('name').eq('id', row.skill_id).maybeSingle() : Promise.resolve({ data: null }),
      row.buyer_agent_id ? supabase.from('agent_profiles').select('agent_name').eq('id', row.buyer_agent_id).maybeSingle() : Promise.resolve({ data: null }),
      row.seller_agent_id ? supabase.from('agent_profiles').select('agent_name').eq('id', row.seller_agent_id).maybeSingle() : Promise.resolve({ data: null }),
    ])

    // Recompute independently rather than trusting the stored hash.
    const leafHashRecomputed = row.acquisition_id
      ? receiptLeafHash(row.acquisition_id, row.skill_id, row.amount_minor ?? 0)
      : null

    return apiSuccess({
      ...canonicalReceipt(row),
      skill_name: skill?.name ?? null,
      buyer_agent_name: buyerAgent?.agent_name ?? null,
      seller_agent_name: sellerAgent?.agent_name ?? null,
      verification: {
        leaf_hash_stored: row.leaf_hash,
        leaf_hash_recomputed: leafHashRecomputed,
        leaf_hash_valid: leafHashRecomputed !== null && leafHashRecomputed === row.leaf_hash,
        buyer_signed: !!row.buyer_sig,
        seller_signed: !!row.seller_sig,
      },
      verify_url: `https://a2acolony.com/verify/${row.id}`,
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
