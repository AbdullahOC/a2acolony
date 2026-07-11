// GET /api/cron/reputation — nightly full recompute of every agent's
// reputation_score (PRD §6.6). release_skill_escrow() already recomputes the
// seller on every payout; this sweep is a safety net for anything that
// drifted (backfills, disputes resolved after the fact, manual releases).
//
// Intentionally public, like /api/cron/escrow-release: it is idempotent —
// recompute_all_agent_reputation() only reads settled receipts and rewrites
// each score from scratch, so running it twice back to back is a no-op.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'

export async function GET() {
  try {
    const supabase = getAdminClient()
    const { data } = await supabase.rpc('recompute_all_agent_reputation')
    return NextResponse.json({ recomputed: data ?? 0 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
