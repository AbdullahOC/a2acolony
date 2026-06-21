import { createAdminClient } from '@/lib/supabase-admin'
import { TransactionRowActions, CashoutForm } from '../Interactive'

export const dynamic = 'force-dynamic'

async function safeList(table: string, sel: string, orderCol: string) {
  try {
    const s = createAdminClient()
    const { data, error } = await s
      .from(table)
      .select(sel)
      .order(orderCol, { ascending: false })
      .limit(50)
    if (error) return { rows: [] as any[], err: error.message }
    return { rows: (data as any[]) || [], err: null as string | null }
  } catch (e: any) {
    return { rows: [] as any[], err: e?.message || 'error' }
  }
}

const gbp = (n: any) => '£' + Number(n || 0).toFixed(2)

async function companyFunds(): Promise<{ available: number; tableReady: boolean }> {
  const s = createAdminClient()
  let fees = 0
  try {
    const { data } = await s.from('transactions').select('platform_fee').limit(10000)
    for (const r of (data as any[]) || []) fees += Number(r.platform_fee || 0)
  } catch {}
  let cashed = 0
  let tableReady = true
  try {
    const { data, error } = await s.from('company_cashouts').select('amount_gbp, status')
    if (error) tableReady = false
    else for (const r of (data as any[]) || []) if (r.status !== 'cancelled') cashed += Number(r.amount_gbp || 0)
  } catch {
    tableReady = false
  }
  return { available: Math.max(0, Math.round((fees - cashed) * 100) / 100), tableReady }
}

export default async function AdminTransactions() {
  const [tx, acq, funds] = await Promise.all([
    safeList('transactions', 'id, gross_amount, platform_fee, seller_payout, status, created_at', 'created_at'),
    safeList('acquisitions', 'id, amount_paid, payment_method, status, acquired_at', 'acquired_at'),
    companyFunds(),
  ])

  return (
    <div className="space-y-8">
      <CashoutForm availableGbp={funds.available} tableReady={funds.tableReady} />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Recent transactions</h2>
        {tx.err && <p className="text-sm text-red-400">{tx.err}</p>}
        <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2535] bg-[#0d1117] text-left text-xs uppercase tracking-wide text-[#5b6677]">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Gross</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Payout</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2535]">
              {tx.rows.map((t) => (
                <tr key={t.id} className="transition hover:bg-[#0d1117]">
                  <td className="px-4 py-3 font-mono text-xs text-[#8892a4]">{String(t.id).slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white">{gbp(t.gross_amount)}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{gbp(t.platform_fee)}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{gbp(t.seller_payout)}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{t.status || '—'}</td>
                  <td className="px-4 py-3 text-[#8892a4]">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <TransactionRowActions id={t.id} status={t.status || 'pending'} />
                    </div>
                  </td>
                </tr>
              ))}
              {tx.rows.length === 0 && !tx.err && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#5b6677]">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Recent acquisitions</h2>
        {acq.err && <p className="text-sm text-red-400">{acq.err}</p>}
        <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1e2535] bg-[#0d1117] text-left text-xs uppercase tracking-wide text-[#5b6677]">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e2535]">
              {acq.rows.map((a) => (
                <tr key={a.id} className="transition hover:bg-[#0d1117]">
                  <td className="px-4 py-3 font-mono text-xs text-[#8892a4]">{String(a.id).slice(0, 8)}</td>
                  <td className="px-4 py-3 text-white">{gbp(a.amount_paid)}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{a.payment_method || '—'}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{a.status || '—'}</td>
                  <td className="px-4 py-3 text-[#8892a4]">
                    {a.acquired_at ? new Date(a.acquired_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {acq.rows.length === 0 && !acq.err && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#5b6677]">
                    No acquisitions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-[#5b6677]">
        Refund &amp; payout approvals run through the existing <code>/api/v1/admin/queue</code>,{' '}
        <code>/api/v1/admin/refunds/&#123;id&#125;</code> and <code>/api/v1/admin/cashouts/&#123;id&#125;</code> endpoints.
      </p>
    </div>
  )
}
