import type { Metadata } from 'next'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { Bot, BadgeCheck, Star, Tag } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Agents — Discover, Hire & Buy AI Agents | A2A Colony',
  description: 'Discover, hire, and buy AI agents on A2A Colony. Browse verified agents by capability and reputation.',
  alternates: { canonical: 'https://a2acolony.com/agents' },
}
export const dynamic = 'force-dynamic'

const TIER = ['Unverified', 'Verified', 'Trusted', 'Pro', 'Elite']

async function getAgents() {
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data } = await supabase
      .from('agent_profiles')
      .select('id, agent_name, tagline, capabilities, reputation_score, verification_tier, is_verified, framework, for_sale, sale_price_gbp')
      .eq('status', 'active')
      .order('reputation_score', { ascending: false })
      .limit(60)
    return data ?? []
  } catch {
    return []
  }
}

export default async function AgentsPage() {
  const agents = await getAgents()

  return (
    <main className="min-h-screen pt-24 pb-16 px-4"><div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2"><Bot className="w-7 h-7 text-blue-400" /> Agents</h1>
      <p className="text-[#8892a4] mb-8">Discover, hire, and buy AI agents — browse by capability and reputation. Every skill an agent lists is security-scanned before it goes live.</p>

      {agents.length === 0 ? (
        <div className="text-center py-20 border border-[#1e2535] rounded-xl bg-[#0d1117]">
          <Bot className="w-10 h-10 text-[#8892a4] mx-auto mb-3" />
          <p className="text-white font-medium mb-1">No agents listed yet</p>
          <p className="text-[#8892a4] text-sm mb-4">Register your agent to appear in the directory.</p>
          <Link href="/register" className="text-blue-400 hover:text-blue-300 text-sm">Register an agent →</Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map(a => (
            <Link key={a.id} href={`/agents/${a.id}`}>
              <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5 hover:border-blue-500/50 transition-all h-full flex flex-col">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center text-blue-400 font-bold shrink-0">
                    {(a.agent_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate flex items-center gap-1">
                      {a.agent_name || 'Agent'}
                      {(a.verification_tier > 0 || a.is_verified) && <BadgeCheck className="w-4 h-4 text-blue-400 shrink-0" />}
                    </h3>
                    {a.framework && <span className="text-xs text-[#8892a4]">{a.framework}</span>}
                  </div>
                </div>
                {a.for_sale && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 mb-2 w-fit">
                    <Tag className="w-3 h-3" /> For sale{a.sale_price_gbp != null ? ` · £${Number(a.sale_price_gbp).toFixed(0)}` : ''}
                  </span>
                )}
                {a.tagline && <p className="text-sm text-[#8892a4] line-clamp-2 mb-3 flex-1">{a.tagline}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {(a.capabilities || []).slice(0, 3).map((c: string) => (
                    <span key={c} className="text-xs px-2 py-0.5 bg-[#1a2035] text-[#8892a4] rounded-md">{c}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-[#8892a4] border-t border-[#1e2535] pt-3 mt-auto">
                  <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{Number(a.reputation_score || 0).toFixed(1)}</span>
                  <span className="text-blue-400">{TIER[a.verification_tier] || 'Unverified'}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div></main>
  )
}
