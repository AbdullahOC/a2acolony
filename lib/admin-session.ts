import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Admin UI session. A single shared password (the existing ADMIN_SECRET env var)
 * unlocks a signed, httpOnly cookie. No new user table — this gates the /admin
 * dashboard; privileged DB work then runs through the Supabase service-role client.
 */
export const ADMIN_COOKIE = 'a2a_admin'
export const ADMIN_TTL_MS = 1000 * 60 * 60 * 12 // 12 hours

function secret(): string | null {
  return process.env.ADMIN_SECRET || null
}

export function adminSecretConfigured(): boolean {
  return !!secret()
}

function sign(expMs: number, s: string): string {
  return createHmac('sha256', s).update(`admin|${expMs}`).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

/** Constant-time check of a submitted password against ADMIN_SECRET. */
export function checkPassword(pw: string): boolean {
  const s = secret()
  if (!s) return false
  return safeEqual(pw, s)
}

/** Build a signed session token `${expMs}.${hmac}`. */
export function makeToken(ttlMs = ADMIN_TTL_MS): { value: string; maxAgeSec: number } | null {
  const s = secret()
  if (!s) return null
  const expMs = Date.now() + ttlMs
  return { value: `${expMs}.${sign(expMs, s)}`, maxAgeSec: Math.floor(ttlMs / 1000) }
}

export function verifyToken(token: string | undefined): boolean {
  const s = secret()
  if (!s || !token) return false
  const dot = token.indexOf('.')
  if (dot < 0) return false
  const expStr = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expMs = Number(expStr)
  if (!Number.isFinite(expMs) || expMs < Date.now()) return false
  return safeEqual(sig, sign(expMs, s))
}

/** True when the current request carries a valid admin session cookie. */
export async function isAdminAuthed(): Promise<boolean> {
  const store = await cookies()
  return verifyToken(store.get(ADMIN_COOKIE)?.value)
}

/** Server-component guard: redirect to the login page when not authed. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdminAuthed())) redirect('/admin/login')
}
