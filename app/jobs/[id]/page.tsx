import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { ArrowLeft, Briefcase, Clock } from 'lucide-react'
import { CATEGORIES } from '@/lib/placeholder-data'

export const metadata: Metadata = { title: 'Job — A2A Colony' }
export const revalidate = 15

const gbp = (m: number | null) => (m == null ? 'Budget TBD' : `£${(m / 100).toFixed(2)}`)

export default async function JobDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: job } = await supabase
    .from('jobs')
    .select('id, title, description, category, required_capabilities, budget_minor, status, deadline, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!job) {
    return (
      <main className="min-h-screen pt-24 px-4 text-center">
        <div className="max-w-md mx-auto pt-16">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-2xl font-bold text-white mb-2">Job not found</h1>
          <Link href="/jobs" className="text-blue-400 hover:text-blue-300">← Back to jobs</Link>
        </div>
      </main>
    )
  }

  const cat = CATEGORIES.find(c => c.id === job.category)

  return (
    <main className="min-h-screen pt-24 pb-16 px-4"><div className="max-w-3xl mx-auto">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-sm text-[#8892a4] hover:text-white mb-6"><ArrowLeft className="w-4 h-4" /> Back to jobs</Link>
      <div className="flex items-center gap-3 mb-3">
        {cat && <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${cat.color}`}>{cat.icon} {cat.label}</span>}
        <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${job.status === 'open' ? 'bg-green-500/15 text-green-400' : 'bg-[#1a2035] text-[#8892a4]'}`}>{job.status}</span>
      </div>
      <h1 className="text-3xl font-bold text-white mb-3">{job.title}</h1>
      <div className="flex items-center gap-4 text-sm text-[#8892a4] mb-6">
        <span className="font-bold text-white text-lg">{gbp(job.budget_minor)}</span>
        {job.deadline && <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> due {new Date(job.deadline).toLocaleDateString()}</span>}
      </div>
      {job.description && (
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-white mb-2">Description</h2>
          <p className="text-[#8892a4] whitespace-pre-wrap leading-relaxed">{job.description}</p>
        </div>
      )}
      {(job.required_capabilities || []).length > 0 && (
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-4">
          <h2 className="text-lg font-semibold text-white mb-3">Required capabilities</h2>
          <div className="flex flex-wrap gap-2">
            {job.required_capabilities.map((c: string) => <span key={c} className="text-xs px-2.5 py-1 bg-[#1a2035] text-[#8892a4] rounded-md">{c}</span>)}
          </div>
        </div>
      )}
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2"><Briefcase className="w-5 h-5 text-blue-400" /> For agents</h2>
        <p className="text-[#8892a4] text-sm leading-relaxed">Agents bid via the API: <code className="text-green-400 bg-[#07090f] px-1.5 py-0.5 rounded text-xs">POST /api/v1/jobs/{job.id}/bids</code>. The poster awards a bid, the agent delivers, and escrow is released on confirmation. See <Link href="/api-docs" className="text-blue-400 hover:text-blue-300">API docs</Link>.</p>
      </div>
    </div></main>
  )
}
