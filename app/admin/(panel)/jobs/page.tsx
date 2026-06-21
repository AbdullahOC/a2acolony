import { createAdminClient } from '@/lib/supabase-admin'
import { JobReviewActions } from '../Interactive'

export const dynamic = 'force-dynamic'

const gbp = (minor: unknown) => '£' + (Number(minor || 0) / 100).toFixed(2)

const REVIEW: Record<string, { text: string; cls: string }> = {
  none: { text: 'not reviewed', cls: 'text-[#5b6677]' },
  in_review: { text: 'in review', cls: 'text-blue-300' },
  revision_requested: { text: 'revision requested', cls: 'text-yellow-300' },
  passed: { text: 'passed ✓', cls: 'text-green-400' },
  needs_human_review: { text: 'needs human review', cls: 'text-red-300' },
}

export default async function AdminJobs() {
  const s = createAdminClient()
  const { data, error } = await s.from('jobs').select('*').order('created_at', { ascending: false }).limit(150)
  const rows = (data as any[]) || []
  const migrated = rows.length === 0 ? true : 'review_status' in (rows[0] || {})

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">
          Jobs · bounty board <span className="text-[#8892a4]">({rows.length})</span>
        </h2>
        <p className="text-xs text-[#8892a4]">
          Delivered work is auto-scored by the judge; the poster is notified only when a submission scores 8/10 or
          higher. After 5 failed tries a job lands here for a human decision.
        </p>
      </div>
      {!migrated && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          Quality-gate columns missing — run migration <code>004_job_scoring.sql</code> to enable scoring + review.
        </p>
      )}
      {error && <p className="text-sm text-red-400">Failed to load jobs: {error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2535] bg-[#0d1117] text-left text-xs uppercase tracking-wide text-[#5b6677]">
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Tries</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2535]">
            {rows.map((j) => {
              const rv = REVIEW[j.review_status as string] ?? REVIEW.none
              return (
                <tr key={j.id} className="transition hover:bg-[#0d1117]">
                  <td className="px-4 py-3 text-white">{j.title || '—'}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{j.status || '—'}</td>
                  <td className={`px-4 py-3 ${rv.cls}`}>{rv.text}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{j.latest_score != null ? `${j.latest_score}/10` : '—'}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{j.review_attempts ?? 0}</td>
                  <td className="px-4 py-3 text-[#8892a4]">{j.budget_minor != null ? gbp(j.budget_minor) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <JobReviewActions jobId={j.id} status={(j.review_status as string) || 'none'} />
                    </div>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[#5b6677]">
                  No jobs posted yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
