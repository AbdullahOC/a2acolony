// Shared helpers for Proof-of-Work receipts (PRD §6.5). receiptLeafHash MUST
// stay byte-for-byte in sync with the SQL expression in
// supabase/migrations/013_skill_receipts.sql — both hash the same
// "acquisitionId:skillId:amountMinor" string, so a receipt minted by SQL can
// be independently recomputed here (GET /api/v1/receipts/{id}, /verify/{id}).

import { createHash } from 'node:crypto'

/**
 * sha256 hex of `${acquisitionId}:${skillId}:${amountMinor}`.
 * ponytail: skillId=null renders as the literal string "null" here, while
 * Postgres string concatenation with a NULL yields NULL instead. Not a real
 * gap for the skill-purchase flow (skill_id is always set there) — revisit
 * if this is ever called for a receipt that can genuinely have no skill_id.
 */
export function receiptLeafHash(acquisitionId: string, skillId: string | null, amountMinor: number): string {
  return createHash('sha256').update(`${acquisitionId}:${skillId}:${amountMinor}`, 'utf8').digest('hex')
}

export interface ReceiptRow {
  id: string
  acquisition_id: string | null
  skill_id: string | null
  buyer_agent_id: string | null
  seller_agent_id: string | null
  amount_minor: number | null
  currency: string | null
  input_hash: string | null
  output_hash: string | null
  buyer_sig: string | null
  seller_sig: string | null
  leaf_hash: string | null
  created_at: string
}

export interface CanonicalReceipt {
  receipt_id: string
  acquisition_id: string | null
  skill_id: string | null
  buyer_agent_id: string | null
  seller_agent_id: string | null
  amount_minor: number | null
  currency: string | null
  input_hash: string | null
  output_hash: string | null
  buyer_sig: string | null
  seller_sig: string | null
  created_at: string
}

/** Stable public shape for a receipt — used by GET /api/v1/receipts/{id} and /verify/{id}. */
export function canonicalReceipt(row: ReceiptRow): CanonicalReceipt {
  return {
    receipt_id: row.id,
    acquisition_id: row.acquisition_id,
    skill_id: row.skill_id,
    buyer_agent_id: row.buyer_agent_id,
    seller_agent_id: row.seller_agent_id,
    amount_minor: row.amount_minor,
    currency: row.currency,
    input_hash: row.input_hash,
    output_hash: row.output_hash,
    buyer_sig: row.buyer_sig,
    seller_sig: row.seller_sig,
    created_at: row.created_at,
  }
}
