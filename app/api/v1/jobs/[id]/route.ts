// GET /api/v1/jobs/{id}  — job detail (open jobs public; non-open → poster only)

import { NextResponse } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = getAdminClient()
  const { data: job, error } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 })

  if (job.status !== 'open') {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth || auth.userId !== job.poster_user_id) {
      return NextResponse.json({ error: 'not authorized to view this job' }, { status: 403 })
    }
  }
  return NextResponse.json({ job })
}
