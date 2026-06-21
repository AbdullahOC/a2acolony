// POST /api/v1/jobs/{id}/deliver  — assigned agent delivers   (auth: agent API key)
// Body: { output_text?, output_url?, output_hash?, input_hash?, notes? }
//
// Quality gate: every delivery is scored 0-10 by the judge. The poster is only
// notified (job -> 'delivered', a work_receipt is minted) once a submission scores
// >= PASSING_SCORE. Sub-par work returns actionable feedback for the agent to
// revise and re-deliver (the loop). After MAX_REVIEW_ATTEMPTS it is flagged for a human.

import { NextResponse } from 'next/server'
import { getAgentContext } from '@/lib/agent-context'
import { scoreWork } from '@/lib/scoring/judge'
import { PASSING_SCORE, MAX_REVIEW_ATTEMPTS } from '@/lib/scoring/config'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ctx = await getAgentContext(req)
  if (!ctx) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const { data: job } = await ctx.supabase
    .from('jobs')
    .select('id, assigned_agent_id, status, skill_id, budget_minor, currency, title, description, input_brief, required_capabilities, review_attempts')
    .eq('id', id)
    .maybeSingle()
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })
  if (!ctx.agentProfileId || job.assigned_agent_id !== ctx.agentProfileId) {
    return NextResponse.json({ error: 'only the assigned agent can deliver' }, { status: 403 })
  }
  if (job.status !== 'assigned') {
    return NextResponse.json({ error: `job is ${job.status}, not assigned` }, { status: 409 })
  }

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  const work = {
    output_text: (b.output_text as string) ?? null,
    output_url: (b.output_url as string) ?? null,
    notes: (b.notes as string) ?? null,
  }
  const stamp = new Date().toISOString()

  // --- judge the work ---
  const result = await scoreWork(
    { title: job.title, description: job.description, input_brief: job.input_brief, required_capabilities: job.required_capabilities },
    work,
  )
  const attempt = (job.review_attempts ?? 0) + 1
  const passed = result.score >= PASSING_SCORE

  // record this attempt (requires migration 004; ignored if absent)
  await ctx.supabase.from('job_evaluations').insert({
    job_id: id,
    attempt,
    score: result.score,
    passed,
    feedback: result.feedback,
    dimensions: result.dimensions,
    scored_by: result.scoredBy,
  })

  async function setJob(fields: Record<string, unknown>): Promise<boolean> {
    const { error } = await ctx!.supabase.from('jobs').update({ ...fields, updated_at: stamp }).eq('id', id)
    return !error
  }

  if (passed) {
    const { data: receipt, error } = await ctx.supabase
      .from('work_receipts')
      .insert({
        job_id: id,
        seller_agent_id: ctx.agentProfileId,
        input_hash: (b.input_hash as string) ?? null,
        output_hash: (b.output_hash as string) ?? null,
        amount_minor: job.budget_minor ?? null,
        currency: job.currency ?? 'gbp',
      })
      .select('id')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // mark delivered + record the passing review (fall back to plain delivered pre-migration)
    if (!(await setJob({ status: 'delivered', review_status: 'passed', latest_score: result.score, review_attempts: attempt }))) {
      await setJob({ status: 'delivered' })
    }
    return NextResponse.json({
      passed: true,
      score: result.score,
      feedback: result.feedback,
      scored_by: result.scoredBy,
      receipt_id: receipt.id,
      status: 'delivered',
    })
  }

  // not passed — revision loop or escalate
  const escalate = attempt >= MAX_REVIEW_ATTEMPTS
  const gated = await setJob({
    review_status: escalate ? 'needs_human_review' : 'revision_requested',
    latest_score: result.score,
    review_attempts: attempt,
  })
  return NextResponse.json(
    {
      passed: false,
      score: result.score,
      passing_score: PASSING_SCORE,
      feedback: result.feedback,
      dimensions: result.dimensions,
      scored_by: result.scoredBy,
      attempt,
      attempts_remaining: Math.max(0, MAX_REVIEW_ATTEMPTS - attempt),
      status: escalate ? 'needs_human_review' : 'revision_requested',
      ...(gated ? {} : { note: 'quality-gate columns missing — run migration 004' }),
    },
    { status: 200 },
  )
}
