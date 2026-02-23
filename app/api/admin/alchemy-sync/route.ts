import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

/**
 * POST /api/admin/alchemy-sync
 *
 * One-time (or periodic) sync: registers all existing deposit addresses
 * with the Alchemy Address Activity webhook so they receive instant notifications.
 *
 * Requires: Authorization: Bearer <ADMIN_SECRET> header
 * Requires env: ALCHEMY_AUTH_TOKEN, ALCHEMY_WEBHOOK_ID
 */
export async function POST(req: NextRequest) {
  // Simple admin auth
  const adminSecret = process.env.ADMIN_SECRET
  const authHeader = req.headers.get('authorization')
  if (!adminSecret || authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authToken = process.env.ALCHEMY_AUTH_TOKEN
  const webhookId = process.env.ALCHEMY_WEBHOOK_ID
  if (!authToken || !webhookId) {
    return NextResponse.json({ error: 'ALCHEMY_AUTH_TOKEN or ALCHEMY_WEBHOOK_ID not configured' }, { status: 500 })
  }

  const supabase = createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Get all existing deposit addresses
  const { data: addresses, error } = await supabase
    .from('crypto_deposit_addresses')
    .select('address')
    .eq('network', 'base_usdc')

  if (error) {
    return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 })
  }

  if (!addresses || addresses.length === 0) {
    return NextResponse.json({ message: 'No deposit addresses found', synced: 0 })
  }

  const addressList = addresses.map(a => a.address)

  // Register all addresses with Alchemy in one PATCH call
  const res = await fetch('https://dashboard.alchemy.com/api/update-webhook-addresses', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Alchemy-Token': authToken,
    },
    body: JSON.stringify({
      webhook_id: webhookId,
      addresses_to_add: addressList,
      addresses_to_remove: [],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Alchemy API error: ${res.status} ${text}` }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    synced: addressList.length,
    addresses: addressList,
    message: `Successfully registered ${addressList.length} address(es) with Alchemy webhook`,
  })
}
