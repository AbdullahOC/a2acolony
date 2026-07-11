// POST /api/v1/receipts/{id}/sign — agent co-signs a work receipt (PRD §6.5).
// Body: { role: 'buyer' | 'seller', signature } — signature is a 128-char hex
// Ed25519 signature over the receipt's leaf_hash string (the hex string
// itself, UTF-8). Gives the PRD's dual-signed receipts a real path once
// agents hold signing keys (PUT /api/v1/agents/signing-key).

import { NextRequest } from 'next/server'
import { getAgentContext } from '@/lib/agent-context'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { verifyEd25519, isHexKey } from '@/lib/ed25519'
import { withinRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() {
  return handleCors()
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getAgentContext(req)
    if (!ctx) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    if (!(await withinRateLimit(`receipt_sign:${ctx.userId}`, 30, 3600))) {
      return apiError('Too many signing attempts. Limit: 30 per hour.', 'RATE_LIMITED', 429)
    }

    const { id } = await params
    const body = await req.json().catch(() => null)
    if (!body) return apiError('Request body required', 'BAD_REQUEST', 400)

    const role = body.role === 'buyer' || body.role === 'seller' ? body.role : null
    const signature = typeof body.signature === 'string' ? body.signature.trim() : ''
    if (!role) return apiError("role must be 'buyer' or 'seller'", 'BAD_REQUEST', 400)
    if (!isHexKey(signature, 64)) {
      return apiError('signature must be 128 hex characters (64-byte Ed25519 signature)', 'BAD_REQUEST', 400)
    }

    const { data: receipt } = await ctx.supabase
      .from('work_receipts')
      .select('id, buyer_agent_id, seller_agent_id, leaf_hash, buyer_sig, seller_sig')
      .eq('id', id)
      .maybeSingle()
    if (!receipt) {
      return apiError('Receipt not found — receipts are minted when escrow releases.', 'NOT_FOUND', 404)
    }

    const expectedAgentId = role === 'buyer' ? receipt.buyer_agent_id : receipt.seller_agent_id
    if (!ctx.agentProfileId || expectedAgentId !== ctx.agentProfileId) {
      return apiError(`Only the ${role} on this receipt can sign in that role`, 'FORBIDDEN', 403)
    }

    const alreadySigned = role === 'buyer' ? receipt.buyer_sig : receipt.seller_sig
    if (alreadySigned) {
      return apiError(`Receipt already has a ${role} signature`, 'ALREADY_SIGNED', 409)
    }

    if (!receipt.leaf_hash) {
      return apiError('Receipt has no leaf hash to sign', 'BAD_REQUEST', 400)
    }

    const { data: profile } = await ctx.supabase
      .from('profiles')
      .select('signing_public_key')
      .eq('id', ctx.userId)
      .maybeSingle()
    if (!profile?.signing_public_key) {
      return apiError('No signing key on file. Set one via PUT /api/v1/agents/signing-key', 'NO_SIGNING_KEY', 400)
    }
    if (!verifyEd25519(profile.signing_public_key, receipt.leaf_hash, signature)) {
      return apiError('Signature verification failed', 'BAD_SIGNATURE', 400)
    }

    const column = role === 'buyer' ? 'buyer_sig' : 'seller_sig'
    const { error } = await ctx.supabase
      .from('work_receipts')
      .update({ [column]: signature })
      .eq('id', id)
    if (error) return apiError(error.message, 'DB_ERROR', 500)

    return apiSuccess({
      receipt_id: id,
      role,
      signed: true,
      verify_url: `https://a2acolony.com/verify/${id}`,
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
