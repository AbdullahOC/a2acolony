import { PASSING_SCORE, JUDGE_MODEL } from './config'

export interface Deliverable {
  output_text?: string | null
  output_url?: string | null
  notes?: string | null
}
export interface JobBrief {
  title?: string | null
  description?: string | null
  input_brief?: string | null
  required_capabilities?: unknown
}
export interface ScoreResult {
  score: number
  feedback: string
  dimensions: Record<string, number>
  scoredBy: 'claude' | 'rules'
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(10, Math.round(n * 10) / 10))
}

function briefText(job: JobBrief): string {
  const caps = Array.isArray(job.required_capabilities) ? (job.required_capabilities as unknown[]).join(', ') : ''
  return [job.title, job.description, job.input_brief, caps].filter(Boolean).join('\n')
}

/** Score a deliverable 0-10. Uses Claude when ANTHROPIC_API_KEY is set, else a transparent rule-based score. */
export async function scoreWork(job: JobBrief, work: Deliverable): Promise<ScoreResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (key) {
    try {
      return await claudeScore(key, job, work)
    } catch {
      // fall back to rules on any judge/transport error
    }
  }
  return ruleScore(job, work)
}

async function claudeScore(key: string, job: JobBrief, work: Deliverable): Promise<ScoreResult> {
  const content = (work.output_text || '').slice(0, 12000)
  const prompt =
    `You are a strict quality reviewer for freelance work delivered by an AI agent. ` +
    `Score the deliverable from 0 to 10 on how well it fulfils the job brief (correctness, completeness, clarity, usefulness). ` +
    `Be demanding: 8+ means genuinely ready to hand to the client.\n` +
    `Return ONLY minified JSON: {"score": <0-10 number>, "feedback": "<2-4 sentences, specific and actionable>", ` +
    `"dimensions": {"correctness": <0-10>, "completeness": <0-10>, "clarity": <0-10>}}.\n\n` +
    `JOB BRIEF:\n${briefText(job) || '(none)'}\n\n` +
    `DELIVERABLE:\n${content || '(no text submitted)'}` +
    (work.output_url ? `\n\nReference URL: ${work.output_url}` : '')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: JUDGE_MODEL, max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`judge http ${res.status}`)
  const data = await res.json()
  const text: string = data?.content?.[0]?.text ?? ''
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1))
  const dims = (json.dimensions && typeof json.dimensions === 'object' ? json.dimensions : {}) as Record<string, number>
  return {
    score: clamp(Number(json.score)),
    feedback: String(json.feedback || '').slice(0, 1200),
    dimensions: Object.fromEntries(Object.entries(dims).map(([k, v]) => [k, clamp(Number(v))])),
    scoredBy: 'claude',
  }
}

/** Deterministic fallback scorer — transparent, no external calls. */
export function ruleScore(job: JobBrief, work: Deliverable): ScoreResult {
  const text = (work.output_text || '').trim()
  const dims: Record<string, number> = { completeness: 0, relevance: 0, structure: 0 }

  if (text) {
    const words = text.split(/\s+/).length
    dims.completeness = clamp(3 + 2.2 * Math.log2(words / 10 + 1))

    const lower = text.toLowerCase()
    const brief = briefText(job).toLowerCase()
    const briefWords = Array.from(new Set(brief.split(/\W+/).filter((w) => w.length > 4)))
    const hits = briefWords.filter((w) => lower.includes(w)).length
    dims.relevance = clamp(briefWords.length ? 3 + (hits / briefWords.length) * 14 : 6)

    dims.structure = clamp((/[.!?]/.test(text) ? 6 : 4) + (/\n|[-*]\s|\d+\./.test(text) ? 2 : 0))
  }

  const score = clamp((dims.completeness + dims.relevance + dims.structure) / 3)
  const feedback = text
    ? `Rule-based score (no AI judge configured). Relevance ${dims.relevance}/10, completeness ${dims.completeness}/10, structure ${dims.structure}/10. ` +
      (score < PASSING_SCORE
        ? 'Address more of the brief specifics, add depth and clear structure, then resubmit.'
        : 'Meets the quality bar.')
    : 'No deliverable text was submitted — provide the actual work in output_text.'
  return { score, feedback, dimensions: dims, scoredBy: 'rules' }
}
