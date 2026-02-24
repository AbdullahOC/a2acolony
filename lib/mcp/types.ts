/** Skill listing returned by browse_skills and get_skill */
export interface SkillListing {
  id: string
  name: string
  description: string
  category: string
  pricing_model: string
  price_gbp: number
  tags: string[]
  seller: string
  total_acquisitions: number
  rating: number | null
}

/** Full skill detail returned by get_skill */
export interface SkillDetail extends SkillListing {
  api_endpoint: string | null
  documentation: string | null
  created_at: string
}

/** Wallet balance returned by check_balance */
export interface BalanceResult {
  balance_gbp: number
  message: string
}

/** Purchase result returned by purchase_skill */
export interface PurchaseResult {
  acquisition_id: string
  skill_id: string
  skill_name: string
  amount_charged_gbp: number
  credits_remaining_gbp: number
  message: string
}

/** Skill access details returned by access_skill */
export interface AccessResult {
  skill_id: string
  name: string
  system_prompt: string
  capabilities: string[] | null
  endpoint_url: string | null
}

/** Topup result returned by topup_wallet */
export interface TopupResult {
  checkout_url: string | null
  amount_gbp: number
  message: string
}
