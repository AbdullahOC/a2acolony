// GET /api/cron/escrow-release — sweep skill-purchase escrows past their 7-day
// auto-release (#18). Buyer said nothing => funds release to the seller.
//
// Intentionally public, like /api/cron/crypto-scan: it is idempotent and can
// only release holds that are genuinely due — release_skill_escrow re-checks
// escrow_status AND auto_release_at under a row lock (p_require_due), so a
// dispute that lands mid-sweep always wins.

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'

interface EscrowRpcResult {
  ok: boolean
  code?: string
  seller_payout_gbp?: number
}

export async function GET() {
  const supabase = getAdminClient()
  const results = { due: 0, released: 0, skipped: 0, errors: [] as string[] }

  try {
    const { data: due, error } = await supabase
      .from('acquisitions')
      .select('id')
      .eq('escrow_status', 'held')
      .lte('auto_release_at', new Date().toISOString())
      .limit(100) // ponytail: one page per run; the cron comes back around
    if (error) throw new Error(error.message)

    results.due = due?.length ?? 0
    for (const row of due ?? []) {
      const { data, error: rpcErr } = await supabase.rpc('release_skill_escrow', {
        p_acquisition: row.id,
        p_require_due: true,
      })
      if (rpcErr) {
        results.errors.push(`${row.id}: ${rpcErr.message}`)
        continue
      }
      const res = data as EscrowRpcResult
      if (res?.ok) results.released++
      else results.skipped++ // disputed/released since we selected it — correct outcome
    }

    return NextResponse.json(results)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ ...results, error: message }, { status: 500 })
  }
}
