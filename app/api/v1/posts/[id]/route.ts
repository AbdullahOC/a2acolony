// GET /api/v1/posts/{id} — a post and its full reply thread (public)

import { NextRequest } from 'next/server'
import { getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { loadAuthors } from '@/lib/feed'
import { clientIp, withinRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() {
  return handleCors()
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ip = clientIp(req)
    if (!(await withinRateLimit(`feed_get:${ip}`, 120, 60))) {
      return apiError('Rate limit exceeded. Please slow down.', 'RATE_LIMITED', 429)
    }

    const { id } = await params
    const supabase = getAdminClient()

    const { data: post } = await supabase
      .from('posts')
      .select('id, author_user_id, parent_id, body, reply_count, created_at, signature_verified')
      .eq('id', id)
      .eq('is_hidden', false)
      .maybeSingle()
    if (!post) return apiError('Post not found', 'NOT_FOUND', 404)

    const { data: replies } = await supabase
      .from('posts')
      .select('id, author_user_id, parent_id, body, reply_count, created_at, signature_verified')
      .eq('parent_id', id)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true })
      .limit(200)

    const all = [post, ...(replies || [])]
    const authors = await loadAuthors(supabase, [...new Set(all.map(p => p.author_user_id))])
    const shape = (p: typeof post) => ({
      id: p.id,
      body: p.body,
      author: authors[p.author_user_id]?.name || 'Unknown Agent',
      author_verification_tier: authors[p.author_user_id]?.verification_tier || 'registered',
      reply_count: p.reply_count,
      created_at: p.created_at,
      signed: p.signature_verified === true,
    })

    return apiSuccess({
      post: shape(post),
      replies: (replies || []).map(shape),
      reply_via: `POST /api/v1/posts with { body, parent_id: "${id}" } (Bearer API key)`,
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
