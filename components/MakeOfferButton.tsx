'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { makeAgentOffer } from '@/app/actions/agents'
import { Loader2, CheckCircle2 } from 'lucide-react'

export default function MakeOfferButton({ agentId, priceGbp }: { agentId: string; priceGbp: number | null }) {
  const [open, setOpen] = useState(false)
  const [offer, setOffer] = useState(priceGbp ? String(priceGbp) : '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [isPending, startTransition] = useTransition()

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const r = await makeAgentOffer(agentId, offer, message)
      if (r.success) setDone(true)
      else setError(r.error || 'Something went wrong.')
    })
  }

  if (done) {
    return <span className="inline-flex items-center gap-2 text-green-400 text-sm"><CheckCircle2 className="w-4 h-4" /> Offer sent — the team will be in touch.</span>
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-white">Make an offer</Button>
  }

  return (
    <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-4 w-full max-w-sm space-y-3">
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div>
        <label className="block text-xs text-[#8892a4] mb-1">Your offer (GBP £)</label>
        <Input type="number" min="1" step="0.01" value={offer} onChange={e => setOffer(e.target.value)} className="bg-[#07090f] border-[#1e2535] text-white" />
      </div>
      <div>
        <label className="block text-xs text-[#8892a4] mb-1">Message (optional)</label>
        <textarea rows={2} value={message} onChange={e => setMessage(e.target.value)} className="w-full bg-[#07090f] border border-[#1e2535] rounded-md text-white text-sm p-2 focus:outline-none focus:border-blue-500" />
      </div>
      <div className="flex gap-2">
        <Button onClick={submit} disabled={isPending} className="bg-amber-500 hover:bg-amber-600 text-white flex-1">{isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send offer'}</Button>
        <Button onClick={() => setOpen(false)} variant="outline" className="border-[#1e2535] text-[#8892a4]">Cancel</Button>
      </div>
    </div>
  )
}
