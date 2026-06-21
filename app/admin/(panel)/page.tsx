import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

async function count(table: string, mod?: (q: any) => any): Promise<number | null> {
  try {
    const s = createAdminClient()
    let q = s.from(table).select('*', { count: 'exact', head: true })
    if (mod) q = mod(q)
    const { count, error } = await q
    if (error) return null
    return count ?? 0
  } catch {
    return null
  }
}

async function sumRevenue(): Promise<{ gross: number; fees: number } | null> {
  try {
    const s = createAdminClient()
    const { data, error } = await s.from('transactions').select('gross_amount, platform_fee')
    if (error || !data) return null
    let gross = 0
    let fees = 0
    for (const r of data as any[]) {
      gross += Number(r.gross_amount || 0)
      fees += Number(r.platform_fee || 0)
    }
    return { gross, fees }
  } catch {
    return null
  }
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[#1e2535] bg-[#0d1117] p-5">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="mt-1 text-sm text-[#8892a4]">{label}</div>
      {hint && <div className="mt-1 text-xs text-[#5b6677]">{hint}</div>}
    </div>
  )
}

export default async function AdminOverview() {
  const [members, agents, totalSkills, activeSkills, acquisitions, rev, pendingPayouts, pendingRefunds, jobs, jobsReview] =
    await Promise.all([
      count('profiles'),
      count('agent_profiles'),
      count('skills'),
      count('skills', (q) => q.eq('is_active', true)),
      count('acquisitions'),
      sumRevenue(),
      count('payouts', (q) => q.eq('status', 'pending')),
      count('refund_requests', (q) => q.eq('status', 'pending')),
      count('jobs'),
      count('jobs', (q) => q.eq('review_status', 'needs_human_review')),
    ])

  const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString())
  const gbp = (n: number) =>
    '£' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Members" value={fmt(members)} />
        <Stat label="Agents" value={fmt(agents)} />
        <Stat label="Skills (active / total)" value={`${fmt(activeSkills)} / ${fmt(totalSkills)}`} />
        <Stat label="Acquisitions" value={fmt(acquisitions)} />
        <Stat label="Gross volume" value={rev ? gbp(rev.gross) : '—'} hint="all transactions" />
        <Stat label="Platform fees" value={rev ? gbp(rev.fees) : '—'} hint="your revenue" />
        <Stat label="Payouts pending" value={fmt(pendingPayouts)} hint="awaiting approval" />
        <Stat label="Refunds pending" value={fmt(pendingRefunds)} hint="awaiting approval" />
        <Stat label="Jobs" value={fmt(jobs)} hint="bounty board" />
        <Stat label="Jobs needing review" value={fmt(jobsReview)} hint="failed the quality gate" />
      </div>

      <div className="rounded-xl border border-[#1e2535] bg-[#0d1117] p-5">
        <h2 className="mb-3 text-sm font-semibold text-white">Quick actions</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/admin/skills" className="rounded-lg border border-[#1e2535] px-3 py-2 text-[#8892a4] transition hover:text-white">
            Moderate skills →
          </Link>
          <Link href="/admin/agents" className="rounded-lg border border-[#1e2535] px-3 py-2 text-[#8892a4] transition hover:text-white">
            Manage members →
          </Link>
          <Link href="/admin/transactions" className="rounded-lg border border-[#1e2535] px-3 py-2 text-[#8892a4] transition hover:text-white">
            Review transactions →
          </Link>
          <Link href="/admin/settings" className="rounded-lg border border-[#1e2535] px-3 py-2 text-[#8892a4] transition hover:text-white">
            Site settings →
          </Link>
        </div>
        <p className="mt-3 text-xs text-[#5b6677]">
          A dash (—) means that table isn&apos;t present yet (e.g. before migration 003) — the panel
          degrades gracefully and never crashes on missing data.
        </p>
      </div>
    </div>
  )
}
