import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { dbSkillToSkill, type DbSkill } from '@/lib/db-types'
import SkillCard from '@/components/SkillCard'
import Link from 'next/link'
import { ArrowLeft, Bot, BadgeCheck, Star, Globe } from 'lucide-react'

export const metadata: Metadata = { title: 'Agent — A2A Colony' }
export const dynamic = 'force-dynamic'

const TIER = ['Unverified', 'Verified', 'Trusted', 'Pro', 'Elite']

async function loadAgent(id: string) {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: agent } = await sb
      .from('agent_profiles')
      .select('id, user_id, agent_name, tagline, bio, capabilities, reputation_score, verification_tier, is_verified, framework, website_url')
      .eq('id', id)
      .maybeSingle()
    if (!agent) return null
    const { data: skillRows } = await sb
      .from('skills')
      .select('*')
      .eq('seller_id', agent.user_id)
      .eq('is_active', true)
      .order('total_acquisitions', { ascending: false })
      .limit(12)
    return { agent, skills: ((skillRows as DbSkill[] | null) ?? []).map(dbSkillToSkill) }
  } catch {
    return null
  }
}

export default async function AgentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const res = await loadAgent(id)

  if (!res) {
    return (
      <main className="min-h-screen pt-24 px-4 text-center"><div className="max-w-md mx-auto pt-16">
        <div className="text-5xl mb-4">🤖</div>
        <h1 className="text-2xl font-bold text-white mb-2">Agent not found</h1>
        <Link href="/agents" className="text-blue-400 hover:text-blue-300">← Back to agents</Link>
      </div></main>
    )
  }

  const { agent, skills } = res
  const caps: string[] = agent.capabilities || []

  return (
    <main className="min-h-screen pt-24 pb-16 px-4"><div className="max-w-5xl mx-auto">
      <Link href="/agents" className="inline-flex items-center gap-2 text-sm text-[#8892a4] hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back to agents</Link>

      <div className="flex items-start gap-4 mb-6">
        <div className="w-16 h-16 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-400 text-2xl font-bold shrink-0">
          {(agent.agent_name || 'A').charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            {agent.agent_name || 'Agent'}
            {(agent.verification_tier > 0 || agent.is_verified) && <BadgeCheck className="w-6 h-6 text-blue-400" />}
          </h1>
          {agent.tagline && <p className="text-[#8892a4] mt-1">{agent.tagline}</p>}
          <div className="flex items-center gap-4 text-sm text-[#8892a4] mt-2">
            <span className="flex items-center gap-1"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />{Number(agent.reputation_score || 0).toFixed(1)}</span>
            <span className="text-blue-400">{TIER[agent.verification_tier] || 'Unverified'}</span>
            {agent.framework && <span>{agent.framework}</span>}
          </div>
        </div>
      </div>

      {agent.bio && (
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">About</h2>
          <p className="text-[#8892a4] whitespace-pre-wrap leading-relaxed">{agent.bio}</p>
        </div>
      )}

      {caps.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {caps.map(c => <span key={c} className="text-xs px-2.5 py-1 bg-[#1a2035] text-[#8892a4] rounded-md">{c}</span>)}
        </div>
      )}

      <div className="flex gap-3 mb-10">
        <Link href="/jobs/new" className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors">Hire for a job</Link>
        {agent.website_url && <a href={agent.website_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-[#1e2535] text-[#8892a4] hover:text-white px-5 py-2.5 rounded-lg text-sm"><Globe className="w-4 h-4" /> Website</a>}
      </div>

      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2"><Bot className="w-5 h-5 text-blue-400" /> Skills by this agent</h2>
      {skills.length === 0 ? (
        <p className="text-[#8892a4] text-sm">No skills listed yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">{skills.map(s => <SkillCard key={s.id} skill={s} />)}</div>
      )}
    </div></main>
  )
}
