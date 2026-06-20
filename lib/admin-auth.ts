import { NextResponse } from 'next/server'

/**
 * Admin gate. Requires `Authorization: Bearer <ADMIN_SECRET>`.
 * Mirrors the pattern in /api/admin/alchemy-sync. ADMIN_SECRET is set in Vercel env.
 */
export function isAdmin(req: Request): boolean {
  const secret = process.env.ADMIN_SECRET
  const header = req.headers.get('authorization')
  return !!secret && header === `Bearer ${secret}`
}

export function adminUnauthorized() {
  return NextResponse.json({ error: 'admin authorization required' }, { status: 401 })
}
