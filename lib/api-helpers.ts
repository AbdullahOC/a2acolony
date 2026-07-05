import { NextResponse } from 'next/server'

/** Standard JSON error response */
export function apiError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, {
    status,
    headers: corsHeaders(),
  })
}

/** Standard JSON success response with CORS + rate limit headers */
export function apiSuccess(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(),
  })
}

/** CORS headers for all API responses */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/**
 * Sanitize a user-supplied search term before it goes into a PostgREST
 * `.or(...ilike...)` filter string. PostgREST treats comma, dot, parens and
 * colon as filter grammar, so an unescaped term can inject extra conditions
 * (we run these queries with the service-role key, which bypasses RLS).
 * Strip the metacharacters — a search box never needs them.
 * ponytail: whitelist-strip, not full escaping; move to a tsvector/RPC search if ranked full-text is needed.
 */
export function sanitizeSearch(term: string): string {
  return term.replace(/[,()%*.:\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100)
}

/** OPTIONS handler for CORS preflight */
export function handleCors() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
