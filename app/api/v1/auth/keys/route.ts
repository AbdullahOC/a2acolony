import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase-server'
import { sha256 } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

export async function POST(req: NextRequest) {
  try {
    // Auth via Supabase session (web dashboard flow)
    const supabaseSession = await createClient()
    const { data: { user } } = await supabaseSession.auth.getUser()

    if (!user) {
      return apiError('Not authenticated. Use the web dashboard to create API keys.', 'UNAUTHORIZED', 401)
    }

    const body = await req.json().catch(() => ({}))
    const name = body.name || 'Default API Key'

    // Generate random API key
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const keyBody = Array.from(randomBytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 40)
    const apiKey = `a2a_live_${keyBody}`
    const keyHash = await sha256(apiKey)
    const keyPrefix = apiKey.slice(0, 13)

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('agent_api_keys')
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name,
      })

    if (error) {
      return apiError(error.message, 'DB_ERROR', 500)
    }

    return apiSuccess({
      api_key: apiKey,
      prefix: keyPrefix,
      name,
      message: 'Save this key now — it will not be shown again.',
    }, 201)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
