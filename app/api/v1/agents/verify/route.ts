// POST /api/v1/agents/verify — self-serve upgrade registered → verified (#15).
// Gates: (a) payment/funded wallet on file, (b) the agent's endpoint answers.
// 'founding' (the visible badge) stays a manual owner decision — never set here.

import { NextRequest } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { withinRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() {
  return handleCors()
}

// SSRF guard for the outbound health check: the URL is user-controlled.
// ponytail: string-level checks only; DNS-rebinding needs a resolver check — add if this ever fetches bodies.
function isSafeEndpoint(raw: string): boolean {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) return false
  if (host === '::1' || host.startsWith('fd') || host.startsWith('fe80')) return false
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const [a, b] = host.split('.').map(Number)
    if (a === 127 || a === 10 || a === 0 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)) return false
  }
  return true
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    // Outbound fetch per call — keep it slow.
    if (!(await withinRateLimit(`verify:${auth.userId}`, 10, 3600))) {
      return apiError('Too many verification attempts. Please try again later.', 'RATE_LIMITED', 429)
    }

    const supabase = getAdminClient()
    const { data: p, error } = await supabase
      .from('profiles')
      .select('verification_tier, credits_gbp, total_earned, payout_method, api_endpoint')
      .eq('id', auth.userId)
      .single()
    if (error || !p) return apiError('Profile not found', 'NOT_FOUND', 404)

    // Idempotent: already at or above 'verified'.
    if (p.verification_tier === 'verified' || p.verification_tier === 'founding') {
      return apiSuccess({ verification_tier: p.verification_tier, message: `You are already ${p.verification_tier}.` })
    }

    const funded = Number(p.credits_gbp) > 0 || Number(p.total_earned) > 0 || !!p.payout_method
    if (!funded) {
      return apiError(
        'Verification requires a funded wallet or payout details on file. Top up via POST /api/v1/wallet/topup, then retry.',
        'PAYMENT_REQUIRED',
        402
      )
    }

    if (!p.api_endpoint) {
      return apiError('Verification requires an agent endpoint on your profile so buyers can reach you.', 'ENDPOINT_REQUIRED', 400)
    }
    if (!isSafeEndpoint(p.api_endpoint)) {
      return apiError('Your endpoint URL must be a public http(s) address.', 'ENDPOINT_INVALID', 400)
    }

    // Health check: any HTTP answer (even 405/404) proves the host is alive.
    // redirect:'manual' so a redirect can't bounce the probe somewhere internal.
    let healthy = false
    try {
      const res = await fetch(p.api_endpoint, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) })
      healthy = res.status < 500
    } catch {
      healthy = false
    }
    if (!healthy) {
      return apiError('Your endpoint did not respond. Make sure it is live, then retry.', 'ENDPOINT_UNHEALTHY', 400)
    }

    await supabase
      .from('profiles')
      .update({ verification_tier: 'verified' })
      .eq('id', auth.userId)
      .eq('verification_tier', 'registered')

    return apiSuccess({
      verification_tier: 'verified',
      message: 'Verified. Your listings now show the verified tier. Founding status is granted by manual review.',
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
