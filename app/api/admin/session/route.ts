import { NextResponse } from 'next/server'
import {
  ADMIN_COOKIE,
  adminSecretConfigured,
  checkPassword,
  makeToken,
} from '@/lib/admin-session'

// Coarse in-memory rate limit on login attempts (per IP, per minute).
const attempts = new Map<string, { n: number; ts: number }>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60_000
  const max = 8
  const e = attempts.get(ip)
  if (!e || now - e.ts > windowMs) {
    attempts.set(ip, { n: 1, ts: now })
    return false
  }
  e.n++
  return e.n > max
}

export async function POST(req: Request) {
  if (!adminSecretConfigured()) {
    return NextResponse.json(
      { error: 'ADMIN_SECRET is not set on the server.' },
      { status: 503 },
    )
  }
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'
  if (rateLimited(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Try again in a minute.' }, { status: 429 })
  }

  let password = ''
  try {
    const body = await req.json()
    password = String(body?.password ?? '')
  } catch {
    return NextResponse.json({ error: 'Bad request.' }, { status: 400 })
  }

  if (!checkPassword(password)) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 })
  }

  const token = makeToken()
  if (!token) {
    return NextResponse.json({ error: 'Server misconfigured.' }, { status: 503 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, token.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: token.maxAgeSec,
  })
  return res
}

// Logout
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
