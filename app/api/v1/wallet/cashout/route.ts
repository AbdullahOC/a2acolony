// POST /api/v1/wallet/cashout — request a payout of earned funds.
// Reserves the amount (total_pending) and creates a PENDING payout. No money is paid until an admin approves.

import { NextRequest } from 'next/server'
import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'

export async function OPTIONS() {
  return handleCors()
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req.headers.get('authorization'))
    if (!auth) return apiError('Invalid or missing API key', 'UNAUTHORIZED', 401)

    const supabase = getAdminClient()
    const { data: p, error: pErr } = await supabase
      .from('profiles')
      .select('total_earned, total_paid_out, total_pending, payout_method, payout_email, payout_bank_name, payout_account_name, payout_sort_code, payout_account_number')
      .eq('id', auth.userId)
      .single()
    if (pErr || !p) return apiError('Profile not found', 'NOT_FOUND', 404)

    const earned = Number(p.total_earned) || 0
    const paidOut = Number(p.total_paid_out) || 0
    const pending = Number(p.total_pending) || 0
    const available = Math.round((earned - paidOut - pending) * 100) / 100

    const body = await req.json().catch(() => ({} as Record<string, unknown>))
    const amount = Math.round(Number(body.amount_gbp == null ? available : body.amount_gbp) * 100) / 100
    if (!(amount > 0)) return apiError('amount_gbp must be greater than 0', 'BAD_REQUEST', 400)
    if (amount > available) return apiError(`Insufficient withdrawable balance. Available: GBP ${available.toFixed(2)}`, 'BAD_REQUEST', 400)

    // reserve so it can't be requested twice (does NOT pay out)
    const { data: reserved } = await supabase
      .from('profiles')
      .update({ total_pending: Math.round((pending + amount) * 100) / 100 })
      .eq('id', auth.userId).eq('total_pending', pending).select('id')
    if (!reserved || reserved.length === 0) return apiError('Balance changed, please retry', 'CONFLICT', 409)

    const today = new Date().toISOString().slice(0, 10)
    const { data: payout, error: poErr } = await supabase
      .from('payouts')
      .insert({
        seller_id: auth.userId,
        gross_amount: amount,
        currency: 'gbp',
        payout_method: p.payout_method ?? null,
        payout_email: p.payout_email ?? null,
        payout_bank_name: p.payout_bank_name ?? null,
        payout_account_name: p.payout_account_name ?? null,
        payout_sort_code: p.payout_sort_code ?? null,
        payout_account_number: p.payout_account_number ?? null,
        period_start: today,
        period_end: today,
        transaction_count: 0,
        status: 'pending',
      })
      .select('id')
      .single()
    if (poErr) {
      await supabase.from('profiles').update({ total_pending: pending }).eq('id', auth.userId)
      return apiError(poErr.message, 'DB_ERROR', 500)
    }

    return apiSuccess({
      payout_id: payout.id,
      amount_gbp: amount,
      status: 'pending',
      payout_details_on_file: !!(p.payout_method || p.payout_account_number || p.payout_email),
      message: 'Cashout requested. Funds are reserved and paid only after admin approval.',
    })
  } catch (err: unknown) {
    return apiError(err instanceof Error ? err.message : 'Unknown error', 'INTERNAL_ERROR', 500)
  }
}
