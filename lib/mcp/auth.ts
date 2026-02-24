import { AsyncLocalStorage } from 'node:async_hooks'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

export const apiKeyStorage = new AsyncLocalStorage<string | null>()

export function extractApiKey(request: Request): string | null {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer a2a_live_')) return null
  return auth.slice(7)
}

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Validate an API key from the AsyncLocalStorage context.
 * Returns the userId if valid, null otherwise.
 */
export async function validateStoredApiKey(): Promise<{ userId: string } | null> {
  const apiKey = apiKeyStorage.getStore()
  if (!apiKey) return null

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const keyHash = await sha256(apiKey)

  const { data, error } = await supabase
    .from('agent_api_keys')
    .select('id, user_id')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (error || !data) return null

  // Update last_used_at
  await supabase
    .from('agent_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)

  return { userId: data.user_id }
}
