'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { track, Events } from '@/lib/analytics'

function Tracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    track(Events.PAGE_VIEW, {
      path: pathname,
      search: searchParams.toString(),
      url: window.location.href,
      referrer: document.referrer || null,
    })
  }, [pathname, searchParams])

  return null
}

// Suspense boundary required for useSearchParams in Next.js 14
export default function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  )
}
