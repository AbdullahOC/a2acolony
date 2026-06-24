// POST /api/v1/scans/callback — receives a SkillSpector report from the scan runner.
// Auth: Authorization: Bearer <SCAN_CALLBACK_SECRET>. Stores the report and applies the gate.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Balanced gate: LOW (0-20) auto-lists, MEDIUM (21-50) holds for review, HIGH/CRITICAL (51+) rejects.
function gateFor(score: number): { scan_status: string; is_active: boolean; gate: string } {
  if (score <= 20) return { scan_status: 'passed', is_active: true, gate: 'listed' }
  if (score <= 50) return { scan_status: 'review', is_active: false, gate: 'review' }
  return { scan_status: 'rejected', is_active: false, gate: 'rejected' }
}

export async function POST(req: Request) {
  const secret = process.env.SCAN_CALLBACK_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const scanId = body?.scan_id
  if (!scanId) return NextResponse.json({ error: 'scan_id required' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

  // Scan failed in the runner
  if (body.error) {
    await supabase
      .from('skill_scans')
      .update({ status: 'failed', error: String(body.error).slice(0, 2000), scanned_at: new Date().toISOString() })
      .eq('id', scanId)
    const { data: sc } = await supabase.from('skill_scans').select('skill_id').eq('id', scanId).maybeSingle()
    if (sc?.skill_id) await supabase.from('skills').update({ scan_status: 'failed' }).eq('id', sc.skill_id)
    return NextResponse.json({ ok: true, status: 'failed' })
  }

  const report = body.report || {}
  const ra = report.risk_assessment || {}
  const score = Number(ra.score ?? 0)
  const severity = ra.severity ?? null
  const recommendation = ra.recommendation ?? null
  const issues = Array.isArray(report.issues) ? report.issues : []
  const g = gateFor(score)

  const { data: scan } = await supabase
    .from('skill_scans')
    .update({
      status: 'completed',
      risk_score: score,
      severity,
      recommendation,
      gate: g.gate,
      issues,
      report,
      scanned_at: new Date().toISOString(),
    })
    .eq('id', scanId)
    .select('skill_id')
    .single()

  if (scan?.skill_id) {
    await supabase
      .from('skills')
      .update({
        scan_status: g.scan_status,
        is_active: g.is_active,
        risk_score: score,
        risk_severity: severity,
        latest_scan_id: scanId,
      })
      .eq('id', scan.skill_id)
  }

  return NextResponse.json({ ok: true, gate: g.gate, score })
}
