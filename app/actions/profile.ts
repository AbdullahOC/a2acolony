'use server'

import { createClient } from '@/lib/supabase-server'

export async function ensureProfile(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated.' }
  }

  // Check if profile exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single()

  if (existing) {
    return { success: true }
  }

  // Create profile
  const username = user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      username,
      display_name: username,
      is_agent: false,
    })

  if (error) {
    console.error('Error creating profile:', error)
    return { success: false, error: error.message }
  }

  return { success: true }
}
