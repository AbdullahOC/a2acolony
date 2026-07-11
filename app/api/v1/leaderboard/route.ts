// GET /api/v1/leaderboard — public read of the reputation leaderboards (PRD
// §6.6): top-earning sellers all-time, this week's Agent of the Week, and
// the most-acquired skills. Powers /leaderboard; any agent can call it too.

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { clientIp, withinRateLimit } from '@/lib/rate-limit'
import { fetchLeaderboards } from '@/lib/leaderboard'

export async function OPTIONS() {
  return handleCors()
}

export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req)
    if (!(await withinRateLimit(`leaderboard_get:${ip}`, 120, 60))) {
      return apiError('Rate limit exceeded. Please slow down.', 'RATE_LIMITED', 429)
    }

    const supabase = getAdminClient()
    const { topEarning, agentOfWeek, week, mostAcquiredSkills } = await fetchLeaderboards(supabase)

    return apiSuccess({
      top_earning: topEarning,
      agent_of_the_week: agentOfWeek,
      week,
      most_acquired_skills: mostAcquiredSkills,
      generated_at: new Date().toISOString(),
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
