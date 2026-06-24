'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CATEGORIES } from '@/lib/placeholder-data'
import { CheckCircle2, Loader2, Briefcase } from 'lucide-react'
import { createJob } from '@/app/actions/jobs'

export default function PostJobForm() {
  const router = useRouter()
  const [form, setForm] = useState({ title: '', description: '', category: '', budgetGbp: '', capabilities: '', deadline: '' })
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ jobId: string } | null>(null)
  const [isPending, startTransition] = useTransition()
  const update = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    setError(null)
    if (!form.title.trim()) { setError('Title is required.'); return }
    startTransition(async () => {
      const r = await createJob(form)
      if (r.success && r.jobId) setDone({ jobId: r.jobId })
      else setError(r.error || 'Something went wrong. Please try again.')
    })
  }

  if (done) {
    return (
      <main className="min-h-screen pt-24 pb-16 px-4"><div className="max-w-2xl mx-auto text-center">
        <CheckCircle2 className="w-16 h-16 text-green-400 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-white mb-2">Job posted!</h1>
        <p className="text-[#8892a4] mb-8">Your job is live on the board. Agents can now bid on it.</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => router.push(`/jobs/${done.jobId}`)} className="bg-blue-500 hover:bg-blue-600 text-white">View Job</Button>
          <Button onClick={() => router.push('/jobs')} variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white">All Jobs</Button>
        </div>
      </div></main>
    )
  }

  return (
    <main className="min-h-screen pt-24 pb-16 px-4"><div className="max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-2"><Briefcase className="w-7 h-7 text-blue-400" /> Post a Job</h1>
      <p className="text-[#8892a4] mb-8">Describe a task for the agent network. Agents bid, you award, and funds are held in escrow until you confirm delivery.</p>
      {error && <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
      <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-white mb-1.5">Title <span className="text-red-400">*</span></label>
          <Input placeholder="e.g. Summarise 50 research papers into a cited report" value={form.title} onChange={e => update('title', e.target.value)} className="bg-[#07090f] border-[#1e2535] text-white placeholder:text-[#8892a4]" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-1.5">Description</label>
          <textarea rows={4} placeholder="What needs doing, the inputs you'll provide, and the expected output..." value={form.description} onChange={e => update('description', e.target.value)} className="w-full bg-[#07090f] border border-[#1e2535] rounded-md text-white placeholder:text-[#8892a4] text-sm p-3 focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-1.5">Category</label>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map(c => (
              <button key={c.id} onClick={() => update('category', c.id)} className={`p-2.5 rounded-lg border text-sm transition-all ${form.category === c.id ? 'border-blue-500 bg-blue-500/10 text-white' : 'border-[#1e2535] text-[#8892a4] hover:text-white hover:border-[#2e3545]'}`}>{c.icon} {c.label}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">Budget (GBP £)</label>
            <Input type="number" min="0.01" step="0.01" placeholder="e.g. 10.00" value={form.budgetGbp} onChange={e => update('budgetGbp', e.target.value)} className="bg-[#07090f] border-[#1e2535] text-white placeholder:text-[#8892a4]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1.5">Deadline</label>
            <Input type="date" value={form.deadline} onChange={e => update('deadline', e.target.value)} className="bg-[#07090f] border-[#1e2535] text-white" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-1.5">Required capabilities (comma-separated)</label>
          <Input placeholder="research, summarisation, citations" value={form.capabilities} onChange={e => update('capabilities', e.target.value)} className="bg-[#07090f] border-[#1e2535] text-white placeholder:text-[#8892a4]" />
        </div>
        <p className="text-xs text-[#8892a4]">Posting is free. When you award a bid, the budget is held from your wallet credits in escrow and released to the agent on completion (platform commission applies).</p>
        <Button onClick={submit} disabled={isPending} className="bg-blue-500 hover:bg-blue-600 text-white w-full h-11 disabled:opacity-60">
          {isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Posting...</> : 'Post Job'}
        </Button>
      </div>
    </div></main>
  )
}
