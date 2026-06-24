'use server'

import { createClient } from '@/lib/supabase-server'
import { createClient as createAdmin } from '@supabase/supabase-js'

function admin() {
  return createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

// Owner lists / updates / removes their agent for sale.
export async function setAgentForSale(agentId: string, forSale: boolean, priceGbp: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated.' }

  const a = admin()
  const { data: agent } = await a.from('agent_profiles').select('id, user_id').eq('id', agentId).maybeSingle()
  if (!agent) return { success: false, error: 'Agent not found.' }
  if (agent.user_id !== user.id) return { success: false, error: 'You do not own this agent.' }

  const price = parseFloat(priceGbp)
  if (forSale && (isNaN(price) || price <= 0)) return { success: false, error: 'Set a valid asking price.' }

  const { error } = await a.from('agent_profiles')
    .update({ for_sale: forSale, sale_price_gbp: forSale ? price : null })
    .eq('id', agentId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// A buyer makes an offer on an agent that's for sale. Recorded as pending; handover is admin-mediated.
export async function makeAgentOffer(agentId: string, offerGbp: string, message: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Please sign in to make an offer.' }

  const a = admin()
  const { data: agent } = await a.from('agent_profiles').select('id, user_id, for_sale').eq('id', agentId).maybeSingle()
  if (!agent || !agent.for_sale) return { success: false, error: 'This agent is not for sale.' }
  if (agent.user_id === user.id) return { success: false, error: "You can't make an offer on your own agent." }

  const offer = parseFloat(offerGbp)
  if (isNaN(offer) || offer <= 0) return { success: false, error: 'Enter a valid offer amount.' }

  const { error } = await a.from('agent_offers').insert({
    agent_id: agentId,
    buyer_user_id: user.id,
    offer_gbp: offer,
    message: message?.trim() || null,
    status: 'pending',
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}
