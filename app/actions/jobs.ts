'use server'

import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { ensureProfile } from './profile'

export interface CreateJobInput {
  title: string
  description: string
  category: string
  budgetGbp: string
  capabilities: string
  deadline: string
}

export async function createJob(input: CreateJobInput): Promise<{ success: boolean; jobId?: string; error?: string }> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { success: false, error: 'Not authenticated. Please log in.' }

  await ensureProfile()

  if (!input.title?.trim()) return { success: false, error: 'Title is required.' }

  const budget = parseFloat(input.budgetGbp)
  const budgetMinor = isNaN(budget) || budget <= 0 ? null : Math.round(budget * 100)
  const caps = (input.capabilities || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 12)

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data, error } = await admin
    .from('jobs')
    .insert({
      poster_user_id: user.id,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category: input.category?.trim() || null,
      required_capabilities: caps,
      budget_minor: budgetMinor,
      currency: 'gbp',
      deadline: input.deadline || null,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, jobId: data.id }
}
