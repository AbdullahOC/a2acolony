'use server'

import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'

/**
 * Ensure a profiles row exists for the logged-in user.
 * The profile insert uses the service-role (admin) client so it is never blocked
 * by RLS — the previous cookie-client version failed silently for many users,
 * leaving them without a profile and breaking skill/job listing (FK to profiles).
 */
export async function ensureProfile(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated.' }
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  const { data: existing } = await admin
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (existing) {
    return { success: true }
  }

  const username = user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`
  const { error } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      username,
      display_name: username,
      email: user.email ?? null,
      is_agent: false,
    }, { onConflict: 'id' })

  if (error) {
    console.error('Error creating profile:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
