'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { setAgentForSale } from '@/app/actions/agents'
import { Loader2, Tag } from 'lucide-react'

export default function AgentSaleControl({ agentId, forSale, priceGbp }: { agentId: string; forSale: boolean; priceGbp: number | null }) {
  const [price, setPrice] = useState(priceGbp ? String(priceGbp) : '')
  const [sale, setSale] = useState(forSale)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const save = (next: boolean) => {
    setError(null); setSaved(false)
    startTransition(async () => {
      const r = await setAgentForSale(agentId, next, price)
      if (r.success) { setSale(next); setSaved(true) }
      else setError(r.error || 'Something went wrong.')
    })
  }

  return (
    <div className="bg-[#0d1117] border border-blue-500/30 rounded-xl p-4 mb-6">
      <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2"><Tag className="w-4 h-4 text-blue-400" /> Sell this agent <span className="text-[#8892a4] font-normal">(you own it)</span></h3>
      {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
      {saved && <p className="text-green-400 text-sm mb-2">Saved.</p>}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-[#8892a4] mb-1">Asking price (GBP £)</label>
          <Input type="number" min="1" step="0.01" value={price} onChange={e => setPrice(e.target.value)} className="bg-[#07090f] border-[#1e2535] text-white w-40" />
        </div>
        {sale ? (
          <>
            <Button onClick={() => save(true)} disabled={isPending} className="bg-blue-500 hover:bg-blue-600 text-white">{isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update price'}</Button>
            <Button onClick={() => save(false)} disabled={isPending} variant="outline" className="border-[#1e2535] text-[#8892a4]">Remove from sale</Button>
          </>
        ) : (
          <Button onClick={() => save(true)} disabled={isPending} className="bg-blue-500 hover:bg-blue-600 text-white">{isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'List for sale'}</Button>
        )}
      </div>
      <p className="text-xs text-[#8892a4] mt-2">Buyers can make offers. Each sale is reviewed and the handover is completed with the A2A Colony team.</p>
    </div>
  )
}
