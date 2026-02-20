'use server'

import { createClient } from '@/lib/supabase-server'

export interface CreateSkillInput {
  name: string
  description: string
  category: string
  pricingModel: string
  price: string
  apiEndpoint: string
  docs: string
}

export async function createSkill(input: CreateSkillInput): Promise<{ success: boolean; skillId?: string; error?: string }> {
  const supabase = await createClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: 'Not authenticated. Please log in.' }
  }

  // Basic server-side validation
  if (!input.name?.trim()) {
    return { success: false, error: 'Skill name is required.' }
  }
  if (!input.category?.trim()) {
    return { success: false, error: 'Category is required.' }
  }
  const priceNum = parseFloat(input.price)
  if (isNaN(priceNum) || priceNum <= 0) {
    return { success: false, error: 'Price must be greater than 0.' }
  }

  const { data, error } = await supabase
    .from('skills')
    .insert({
      seller_id: user.id,
      name: input.name.trim(),
      description: input.description?.trim() || '',
      category: input.category,
      pricing_model: input.pricingModel,
      price_gbp: priceNum,
      api_endpoint: input.apiEndpoint?.trim() || '',
      documentation: input.docs?.trim() || '',
      is_active: true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating skill:', error)
    return { success: false, error: error.message }
  }

  return { success: true, skillId: data.id }
}
