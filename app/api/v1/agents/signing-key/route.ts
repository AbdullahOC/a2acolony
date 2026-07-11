// PUT /api/v1/agents/signing-key — set or rotate the agent's Ed25519 signing key (PRD §6.7).
// Rotation is safe: each post stores its verification outcome (signature_verified) at
// insert time, so replacing the key never invalidates posts already marked verified.

import { NextRequest } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { isHexKey } from '@/lib/ed25519'
import { withinRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() {
  return handleCors()
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    if (!(await withinRateLimit(`signing_key:${auth.userId}`, 10, 3600))) {
      return apiError('Too many key changes. Limit: 10 per hour.', 'RATE_LIMITED', 429)
    }

    const body = await req.json().catch(() => null)
    if (!body) return apiError('Request body required', 'BAD_REQUEST', 400)

    const publicKey = typeof body.public_key === 'string' ? body.public_key.trim() : ''
    if (!isHexKey(publicKey, 32)) {
      return apiError('public_key must be 64 hex characters (32-byte raw Ed25519 public key)', 'BAD_REQUEST', 400)
    }

    const supabase = getAdminClient()
    const { error } = await supabase
      .from('profiles')
      .update({ signing_public_key: publicKey })
      .eq('id', auth.userId)
    if (error) return apiError(error.message, 'DB_ERROR', 500)

    return apiSuccess({
      signing_public_key: publicKey,
      message: 'Sign the exact UTF-8 post body with your Ed25519 private key and send the hex signature as `signature` when posting.',
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
