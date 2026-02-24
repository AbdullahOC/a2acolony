'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { CheckCircle, ArrowRight, Bot, Wallet, ExternalLink, AlertCircle, Loader2 } from 'lucide-react'

interface SkillData {
  id: string
  name: string
  description: string | null
  category: string | null
  api_endpoint: string | null
  pricing_model: string
  price_gbp: number
}

interface SkillPurchaseResult {
  type: 'skill_purchase'
  acquisition_id: string
  skill: SkillData
  pricing_model: string
  amount_paid: number
  currency: string
  acquired_at: string
}

interface WalletTopupResult {
  type: 'wallet_topup'
  amount_gbp: number
  status: string
}

type SessionResult = SkillPurchaseResult | WalletTopupResult

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [result, setResult] = useState<SessionResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) {
      setLoading(false)
      return
    }

    fetch(`/api/success?session_id=${encodeURIComponent(sessionId)}`)
      .then(async (res) => {
        const data = await res.json() as SessionResult & { error?: string }
        if (!res.ok) {
          setError(data.error ?? 'Could not load session details')
        } else {
          setResult(data)
        }
      })
      .catch(() => setError('Failed to load session details'))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-[#8892a4]">Loading your purchase details…</p>
        </div>
      </main>
    )
  }

  // Wallet top-up success
  if (result?.type === 'wallet_topup') {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-green-400" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white mb-3">Wallet Topped Up!</h1>
          <p className="text-[#8892a4] mb-2">
            Payment successful. Your wallet has been credited.
          </p>
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-2 mb-8">
            <Wallet className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-semibold text-lg">
              +£{Number(result.amount_gbp).toFixed(2)} added
            </span>
          </div>

          <p className="text-[#8892a4] text-sm mb-8">
            Credits are now available in your wallet. Use them to purchase skills instantly via the API.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/browse">
              <Button variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white">
                Browse skills
              </Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Skill purchase success
  if (result?.type === 'skill_purchase') {
    const skill = result.skill
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Payment Successful!</h1>
            <p className="text-[#8892a4]">
              You&apos;ve acquired <span className="text-white font-medium">{skill.name}</span>
            </p>
          </div>

          {/* Skill details card */}
          <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">{skill.name}</h2>
                {skill.category && (
                  <span className="text-xs text-[#8892a4] bg-[#1e2535] rounded px-2 py-0.5">
                    {skill.category}
                  </span>
                )}
              </div>
            </div>
            {skill.description && (
              <p className="text-[#8892a4] text-sm leading-relaxed">{skill.description}</p>
            )}
          </div>

          {/* How to access */}
          {skill.api_endpoint && (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5 mb-6">
              <h3 className="text-white font-medium mb-3 flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-blue-400" />
                How to access
              </h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[#8892a4] mb-1">API Endpoint</p>
                  <code className="block bg-[#1e2535] rounded-lg px-3 py-2 text-green-400 text-sm font-mono break-all">
                    {skill.api_endpoint}
                  </code>
                </div>
                <div className="bg-[#1e2535] rounded-lg p-3">
                  <p className="text-xs text-[#8892a4] mb-2">Example request</p>
                  <pre className="text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">{`curl -X POST ${skill.api_endpoint} \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input": "your task here"}'`}</pre>
                </div>
              </div>
            </div>
          )}

          {/* API key reminder */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mb-6">
            <p className="text-sm text-[#8892a4]">
              <span className="text-blue-400 font-medium">Your API key</span> is the key you registered with.
              Find it in your <Link href="/dashboard" className="text-blue-400 underline underline-offset-2 hover:text-blue-300">dashboard</Link> under API Keys.
              Use it in the <code className="text-green-400 bg-[#1e2535] px-1 rounded">Authorization: Bearer</code> header.
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/dashboard">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white gap-2 w-full sm:w-auto">
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <Link href="/browse">
              <Button variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white w-full sm:w-auto">
                Browse more skills
              </Button>
            </Link>
          </div>
        </div>
      </main>
    )
  }

  // Fallback: session not found or generic success
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
            {error ? (
              <AlertCircle className="w-10 h-10 text-yellow-400" />
            ) : (
              <CheckCircle className="w-10 h-10 text-green-400" />
            )}
          </div>
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">Payment Successful!</h1>
        <p className="text-[#8892a4] mb-8 leading-relaxed">
          {error
            ? 'Your payment was received. Visit your dashboard to see your acquisitions.'
            : 'Payment complete. Your skill is now available in your dashboard.'}
        </p>

        {/* Code snippet */}
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-4 mb-8 text-left">
          <div className="flex items-center gap-2 text-xs text-[#8892a4] mb-3">
            <Bot className="w-3.5 h-3.5 text-blue-400" />
            Quick start
          </div>
          <pre className="text-green-400 text-xs font-mono overflow-x-auto whitespace-pre-wrap">
{`import requests

response = requests.post(
    "https://a2acolony.com/api/v1/invoke",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"input": "your task here"}
)

print(response.json()["output"])`}
          </pre>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard">
            <Button className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
              Go to Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
          <Link href="/browse">
            <Button variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white">
              Browse more skills
            </Button>
          </Link>
        </div>
      </div>
    </main>
  )
}
