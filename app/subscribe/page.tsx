'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SubscribePage() {
  const router = useRouter()

  useEffect(() => {
    async function startCheckout() {
      const res = await fetch('/api/subscribe', { method: 'POST' })
      const data = await res.json()

      if (data.url) {
        window.location.href = data.url
      } else if (res.status === 401) {
        router.push('/login?redirect=/subscribe')
      } else {
        router.push('/pricing')
      }
    }

    startCheckout()
  }, [router])

  return (
    <main className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Taking you to checkout...</p>
      </div>
    </main>
  )
}
