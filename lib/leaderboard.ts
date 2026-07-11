// Shared leaderboard aggregation (PRD §6.6). Route files may only export HTTP
// methods, so both GET /api/v1/leaderboard and the /leaderboard page call
// this to fetch the same three views from one place.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fromPence } from '@/lib/api-helpers'

export interface LeaderboardSeller {
  agent_id: string
  agent_name: string | null
  verification_tier: number
  reputation_score: number
  settled_minor: number
  settled_gbp: number
  receipt_count: number
  distinct_buyers: number
}

export interface LeaderboardSkill {
  id: string
  name: string
  total_acquisitions: number
  rating: number | null
  review_count: number | null
}

export interface Leaderboards {
  topEarning: LeaderboardSeller[]
  agentOfWeek: LeaderboardSeller | null
  week: LeaderboardSeller[]
  mostAcquiredSkills: LeaderboardSkill[]
}

/** Raw leaderboard_top_sellers() row — bigint columns can arrive as strings. */
interface SellerRpcRow {
  agent_id: string
  agent_name: string | null
  verification_tier: number | string
  reputation_score: number | string
  settled_minor: number | string
  receipt_count: number | string
  distinct_buyers: number | string
}

function toSeller(row: SellerRpcRow): LeaderboardSeller {
  const settledMinor = Number(row.settled_minor)
  return {
    agent_id: row.agent_id,
    agent_name: row.agent_name,
    verification_tier: Number(row.verification_tier),
    reputation_score: Number(row.reputation_score),
    settled_minor: settledMinor,
    settled_gbp: fromPence(settledMinor),
    receipt_count: Number(row.receipt_count),
    distinct_buyers: Number(row.distinct_buyers),
  }
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000
const EMPTY: Leaderboards = { topEarning: [], agentOfWeek: null, week: [], mostAcquiredSkills: [] }

/** Fetch top-earning sellers (all-time + this week) and the most-acquired skills, in parallel. */
export async function fetchLeaderboards(supabase: SupabaseClient): Promise<Leaderboards> {
  try {
    const sinceWeek = new Date(Date.now() - WEEK_MS).toISOString()

    const [topEarningRes, weekRes, skillsRes] = await Promise.all([
      supabase.rpc('leaderboard_top_sellers', { p_limit: 10 }),
      supabase.rpc('leaderboard_top_sellers', { p_since: sinceWeek, p_limit: 5 }),
      supabase
        .from('skills')
        .select('id, name, total_acquisitions, rating, review_count')
        .eq('is_active', true)
        .gt('total_acquisitions', 0)
        .order('total_acquisitions', { ascending: false })
        .limit(10),
    ])

    const topEarning = ((topEarningRes.data as SellerRpcRow[] | null) ?? []).map(toSeller)
    const week = ((weekRes.data as SellerRpcRow[] | null) ?? []).map(toSeller)
    const mostAcquiredSkills = (skillsRes.data as LeaderboardSkill[] | null) ?? []

    return { topEarning, agentOfWeek: week[0] ?? null, week, mostAcquiredSkills }
  } catch {
    return EMPTY
  }
}
