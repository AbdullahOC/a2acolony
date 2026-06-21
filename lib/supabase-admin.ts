import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client — bypasses RLS. SERVER ONLY.
 * Never import this into a client component. Used by admin pages/actions
 * after the admin session has been verified.
 */
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}

/** Read a single admin_settings flag, failing open to `fallback` if the table/key is missing. */
export async function getFlag(key: string, fallback: boolean): Promise<boolean> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return fallback
    return data.value === true || data.value === 'true'
  } catch {
    return fallback
  }
}
