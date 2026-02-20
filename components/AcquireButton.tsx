'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import type { Skill } from '@/lib/placeholder-data'

interface Props {
  skill: Skill
}

type PricingOption = {
  label: string
  price: string
  desc: string
  recommended: boolean
  model: string
}

export default function AcquireButton({ skill }: Props) {
  const router = useRouter()
  const [selectedModel, setSelectedModel] = useState(skill.pricingModel)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const pricingOptions: PricingOption[] = [
    skill.pricingModel === 'per_use' ? {
      label: 'Pay per use',
      price: `£${skill.price}`,
      desc: 'Pay only when you call this skill',
      recommended: false,
      model: 'per_use',
    } : null,
    skill.pricingModel === 'subscription' ? {
      label: 'Monthly subscription',
      price: `£${skill.price}/mo`,
      desc: 'Unlimited calls, cancel anytime',
      recommended: true,
      model: 'subscription',
    } : null,
    skill.pricingModel === 'one_time' ? {
      label: 'One-time purchase',
      price: `£${skill.price}`,
      desc: 'Permanent access, yours forever',
      recommended: true,
      model: 'one_time',
    } : null,
  ].filter((o): o is PricingOption => o !== null)

  async function handleAcquire() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId: skill.id, pricingModel: selectedModel }),
      })

      if (res.status === 401) {
        router.push(`/login?redirect=/skill/${skill.id}`)
        return
      }

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      setError('Failed to start checkout. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <div className="space-y-3 mb-6">
        {pricingOptions.map(opt => (
          <div
            key={opt.model}
            onClick={() => setSelectedModel(opt.model as Skill['pricingModel'])}
            className={`p-4 rounded-lg border cursor-pointer transition-all ${
              selectedModel === opt.model
                ? 'border-blue-500/50 bg-blue-500/10'
                : 'border-[#1e2535] hover:border-[#2e3545]'
            }`}
          >
            {opt.recommended && (
              <span className="text-xs font-medium text-blue-400 mb-1 block">Recommended</span>
            )}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-white">{opt.label}</span>
              <span className="font-bold text-white">{opt.price}</span>
            </div>
            <p className="text-xs text-[#8892a4] mt-1">{opt.desc}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </div>
      )}

      <Button
        onClick={handleAcquire}
        disabled={loading}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white mb-3 h-11"
      >
        {loading ? 'Redirecting to checkout…' : `Acquire Skill — £${skill.price}`}
      </Button>
      <Button
        variant="outline"
        className="w-full border-[#1e2535] text-[#8892a4] hover:text-white"
        disabled={loading}
      >
        Try for Free (10 calls)
      </Button>
    </>
  )
}
