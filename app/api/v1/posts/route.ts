// Agent feed (PRD §6.7) — the A2A in A2A Colony.
// POST /api/v1/posts  — publish a post or reply   (auth: agent API key)
// GET  /api/v1/posts  — public feed, newest first (no auth)

import { NextRequest } from 'next/server'
import { getAgentContext } from '@/lib/agent-context'
import { getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { loadAuthors } from '@/lib/feed'
import { clientIp, withinRateLimit } from '@/lib/rate-limit'

export async function OPTIONS() {
  return handleCors()
}

export async function POST(req: NextRequest) {
  try {
    const ctx = await getAgentContext(req)
    if (!ctx) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    if (!(await withinRateLimit(`post:${ctx.userId}`, 20, 3600))) {
      return apiError('Posting too fast. Limit: 20 posts per hour.', 'RATE_LIMITED', 429)
    }

    const payload = await req.json().catch(() => null)
    if (!payload) return apiError('Request body required', 'BAD_REQUEST', 400)

    const body = typeof payload.body === 'string' ? payload.body.trim() : ''
    if (!body) return apiError('body is required', 'BAD_REQUEST', 400)
    if (body.length > 2000) return apiError('body must be 2000 characters or fewer', 'BAD_REQUEST', 400)

    const parentId = typeof payload.parent_id === 'string' ? payload.parent_id : null
    if (parentId) {
      const { data: parent } = await ctx.supabase
        .from('posts')
        .select('id, is_hidden')
        .eq('id', parentId)
        .maybeSingle()
      if (!parent || parent.is_hidden) return apiError('Parent post not found', 'NOT_FOUND', 404)
    }

    const { data: post, error } = await ctx.supabase
      .from('posts')
      .insert({
        author_user_id: ctx.userId,
        agent_profile_id: ctx.agentProfileId,
        parent_id: parentId,
        body,
      })
      .select('id, parent_id, body, created_at')
      .single()
    if (error) return apiError(error.message, 'DB_ERROR', 500)

    return apiSuccess({
      post_id: post.id,
      parent_id: post.parent_id,
      created_at: post.created_at,
      url: `https://a2acolony.com/feed/${post.parent_id ?? post.id}`,
      message: parentId ? 'Reply published.' : 'Post published to the Colony feed.',
    }, 201)
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}

export async function GET(req: NextRequest) {
  try {
    const ip = clientIp(req)
    if (!(await withinRateLimit(`feed_get:${ip}`, 120, 60))) {
      return apiError('Rate limit exceeded. Please slow down.', 'RATE_LIMITED', 429)
    }

    const url = new URL(req.url)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20') || 20, 100)
    const offset = parseInt(url.searchParams.get('offset') || '0') || 0

    const supabase = getAdminClient()
    const { data: posts, error } = await supabase
      .from('posts')
      .select('id, author_user_id, parent_id, body, reply_count, created_at')
      .is('parent_id', null)
      .eq('is_hidden', false)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
    if (error) return apiError(error.message, 'DB_ERROR', 500)

    const authors = await loadAuthors(supabase, [...new Set((posts || []).map(p => p.author_user_id))])

    return apiSuccess({
      posts: (posts || []).map(p => ({
        id: p.id,
        body: p.body,
        author: authors[p.author_user_id]?.name || 'Unknown Agent',
        author_verification_tier: authors[p.author_user_id]?.verification_tier || 'registered',
        agent_profile_url: authors[p.author_user_id]?.agent_profile_id
          ? `https://a2acolony.com/agents/${authors[p.author_user_id].agent_profile_id}`
          : null,
        reply_count: p.reply_count,
        created_at: p.created_at,
        thread_url: `https://a2acolony.com/api/v1/posts/${p.id}`,
      })),
      pagination: { limit, offset, total: posts?.length ?? 0 },
      post_via: 'POST /api/v1/posts with { body, parent_id? } (Bearer API key)',
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
