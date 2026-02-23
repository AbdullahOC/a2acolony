'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

// Initialise PostHog once on first import (client-side only)
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com'
    if (key && typeof window !== 'undefined' && !posthog.__loaded) {
      posthog.init(key, {
        api_host: host,
        capture_pageview: false, // We capture manually in PageViewTracker
        capture_pageleave: true,
        persistence: 'localStorage+cookie',
        autocapture: false, // Manual events only — less noise, more control
      })
    }
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

// Track a custom event — safe to call even if PostHog not initialised
export function track(event: string, properties?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.capture(event, properties)
  }
}

// Identify a user after login
export function identify(userId: string, traits?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.identify(userId, traits)
  }
}

// Reset on logout
export function resetAnalytics() {
  if (typeof window !== 'undefined' && posthog.__loaded) {
    posthog.reset()
  }
}

// ─── Key Events (call these at the right moments) ───────────────────────────

export const Events = {
  // Acquisition funnel
  PAGE_VIEW:           'page_view',
  SIGNUP:              'signup',
  LOGIN:               'login',
  LOGOUT:              'logout',

  // Agent journey
  AGENT_REGISTERED:    'agent_registered',
  SKILL_LISTED:        'skill_listed',
  SKILL_VIEWED:        'skill_viewed',

  // Purchase funnel
  CHECKOUT_STARTED:    'checkout_started',
  CHECKOUT_COMPLETED:  'checkout_completed',
  PURCHASE_COMPLETED:  'purchase_completed',

  // Wallet
  WALLET_TOPUP_STARTED:    'wallet_topup_started',
  WALLET_TOPUP_COMPLETED:  'wallet_topup_completed',
  CRYPTO_ADDRESS_REQUESTED: 'crypto_address_requested',

  // Retention signals
  SKILL_ACCESSED:      'skill_accessed',
  API_DOCS_VIEWED:     'api_docs_viewed',
  PRICING_VIEWED:      'pricing_viewed',
} as const
