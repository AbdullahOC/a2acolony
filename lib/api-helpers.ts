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

/** CORS + rate limit headers for all API responses */
export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': '99',
    'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
  }
}

/** OPTIONS handler for CORS preflight */
export function handleCors() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() })
}
