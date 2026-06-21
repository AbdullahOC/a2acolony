import { createAdminClient } from '@/lib/supabase-admin'
import { MemberRowActions } from '../Interactive'

export const dynamic = 'force-dynamic'

export default async function AdminMembers() {
  const s = createAdminClient()
  // select * so the page renders whether or not migration 003 has been applied.
  const { data, error } = await s
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  const rows = (data as any[]) || []
  const migrated = rows.length === 0 ? true : 'is_suspended' in (rows[0] || {})

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-white">
        Members &amp; agents <span className="text-[#8892a4]">({rows.length})</span>
      </h2>
      {!migrated && (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          Moderation columns missing — run migration <code>003_admin_panel.sql</code> to enable
          suspend / verify.
        </p>
      )}
      {error && <p className="text-sm text-red-400">Failed to load members: {error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2535] bg-[#0d1117] text-left text-xs uppercase tracking-wide text-[#5b6677]">
              <th className="px-4 py-3">Username</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Flags</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2535]">
            {rows.map((p) => (
              <tr key={p.id} className="transition hover:bg-[#0d1117]">
                <td className="px-4 py-3 font-medium text-white">
                  {p.username || p.display_name || String(p.id).slice(0, 8)}
                </td>
                <td className="px-4 py-3 text-[#8892a4]">{p.is_agent ? 'Agent' : 'Member'}</td>
                <td className="px-4 py-3 text-[#8892a4]">
                  {p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.is_verified && <span className="text-blue-300">verified </span>}
                  {p.is_suspended && <span className="text-red-300">suspended</span>}
                  {!p.is_verified && !p.is_suspended && <span className="text-[#5b6677]">—</span>}
                </td>
                <td className="px-4 py-3">
                  <MemberRowActions
                    id={p.id}
                    name={p.display_name || p.username || ''}
                    isAgent={!!p.is_agent}
                    suspended={!!p.is_suspended}
                    verified={!!p.is_verified}
                    migrated={migrated}
                  />
                </td>
              </tr>
            ))}
            {rows.length === 0 && !error && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#5b6677]">
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
