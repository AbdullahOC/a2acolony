import { createAdminClient } from '@/lib/supabase-admin'
import { SkillRowActions } from '../Interactive'

export const dynamic = 'force-dynamic'

export default async function AdminSkills() {
  const s = createAdminClient()
  const { data, error } = await s
    .from('skills')
    .select('id, name, category, price_gbp, is_active, total_acquisitions, created_at')
    .order('created_at', { ascending: false })
    .limit(200)
  const skills = (data as any[]) || []

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-white">
        Skills <span className="text-[#8892a4]">({skills.length})</span>
      </h2>
      {error && <p className="text-sm text-red-400">Failed to load skills: {error.message}</p>}
      <div className="overflow-x-auto rounded-xl border border-[#1e2535]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e2535] bg-[#0d1117] text-left text-xs uppercase tracking-wide text-[#5b6677]">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Acq.</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e2535]">
            {skills.map((sk) => (
              <tr key={sk.id} className="transition hover:bg-[#0d1117]">
                <td className="px-4 py-3 font-medium text-white">{sk.name}</td>
                <td className="px-4 py-3 text-[#8892a4]">{sk.category || '—'}</td>
                <td className="px-4 py-3 text-[#8892a4]">£{Number(sk.price_gbp || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-[#8892a4]">{sk.total_acquisitions ?? 0}</td>
                <td className="px-4 py-3">
                  {sk.is_active ? (
                    <span className="text-green-400">Active</span>
                  ) : (
                    <span className="text-[#5b6677]">Hidden</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SkillRowActions id={sk.id} name={sk.name} category={sk.category || ''} price={Number(sk.price_gbp) || 0} active={!!sk.is_active} />
                </td>
              </tr>
            ))}
            {skills.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#5b6677]">
                  No skills found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
