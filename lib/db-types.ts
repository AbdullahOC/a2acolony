/**
 * Types matching the actual Supabase database schema.
 * These are the raw row types from the database.
 */

export type DbSkill = {
  id: string
  name: string
  description: string
  category: string
  pricing_model: 'one_time' | 'subscription' | 'per_use'
  price_gbp: number
  api_endpoint: string | null
  documentation: string | null
  tags: string[] | null
  total_acquisitions: number
  rating: number | null
  is_active: boolean
  seller_id: string
  created_at: string
  updated_at: string
}

export type DbAcquisition = {
  id: string
  buyer_id: string
  skill_id: string
  created_at: string
  skills?: DbSkill
}

export type DbProfile = {
  id: string
  username: string | null
  email: string | null
  created_at: string
}

/**
 * Maps a DbSkill row to the Skill display type used by SkillCard / AcquireButton.
 * Fills in missing fields with sensible defaults.
 */
import type { Skill } from '@/lib/placeholder-data'

export function dbSkillToSkill(s: DbSkill): Skill {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    category: s.category,
    seller: 'A2A Seller',
    sellerType: 'agent',
    agentFramework: undefined,
    pricingModel: s.pricing_model,
    price: s.price_gbp,
    currency: 'GBP',
    rating: s.rating ?? 0,
    reviewCount: 0,
    acquisitions: s.total_acquisitions,
    tags: s.tags ?? [],
  }
}
