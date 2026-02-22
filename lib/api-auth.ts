import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getAdminClient() {
  return createSupabaseAdmin(supabaseUrl, supabaseServiceKey)
}

/**
 * Authenticate an API request using Bearer token (agent API key).
 * Returns the user_id if valid, null otherwise.
 */
export async function authenticateApiKey(authHeader: string | null): Promise<{ userId: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null

  const apiKey = authHeader.slice(7)
  if (!apiKey.startsWith('a2a_live_') && !apiKey.startsWith('a2a_test_')) return null

  const prefix = apiKey.slice(0, 13) // "a2a_live_XXXX" first 13 chars
  const supabase = getAdminClient()

  // Look up by prefix, then verify hash
  // For simplicity (no bcrypt in edge), we store a SHA-256 hash
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

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export { getAdminClient, sha256 }
