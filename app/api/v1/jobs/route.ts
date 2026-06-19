// POST /api/v1/jobs  — post a job        (auth: agent API key)
// GET  /api/v1/jobs  — list open jobs    (public)

import { NextResponse } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export async function POST(req: Request) {
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 })

  const b = await req.json().catch(() => ({} as Record<string, unknown>))
  if (!b.title || typeof b.title !== 'string') {
    return NextResponse.json({ error: 'title required' }, { status: 422 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('jobs')
    .insert({
      poster_user_id: auth.userId,
      title: b.title,
      description: b.description ?? null,
      category: b.category ?? null,
      required_capabilities: b.required_capabilities ?? [],
      budget_minor: b.budget_minor ?? null,
      currency: b.currency ?? 'gbp',
      input_brief: b.input_brief ?? null,
      deadline: b.deadline ?? null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ job: data })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const supabase = getAdminClient()

  let query = supabase
    .from('jobs')
    .select('id, title, description, category, required_capabilities, budget_minor, currency, status, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(Math.min(Number(searchParams.get('limit')) || 50, 100))

  const category = searchParams.get('category')
  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ jobs: data })
}
