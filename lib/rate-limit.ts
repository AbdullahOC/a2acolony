import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Fixed-window rate limit backed by the `check_rate_limit` Postgres function.
 * Returns true if the call is within the limit.
 *
 * Fail-open: if the limiter errors we allow the request — a broken limiter must
 * never take the API down.
 * ponytail: one DB round-trip per limited request; fine at current volume, move
 * to Upstash/Vercel KV if it ever shows up in latency.
 */
export async function withinRateLimit(bucket: string, max: number, windowSec: number): Promise<boolean> {
  try {
    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_bucket: bucket,
      p_max: max,
      p_window: windowSec,
    })
    if (error) return true
    return data !== false
  } catch {
    return true
  }
}
