import { PostHog } from 'posthog-node'

// Singleton server-side PostHog client
// Safe to import in any API route or server component
let _client: PostHog | null = null

export function getPostHogClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || key === 'phc_your_project_key_here') return null

  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      flushAt: 1,     // Send immediately (important for serverless/edge functions)
      flushInterval: 0,
    })
  }
  return _client
}

/**
 * Capture a server-side event. Safe to call even when PostHog is not configured
 * (returns silently without throwing).
 */
export async function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>
): Promise<void> {
  const client = getPostHogClient()
  if (!client) return

  try {
    client.capture({ distinctId, event, properties })
    await client.flush()
  } catch (err) {
    // Never let analytics errors break the main flow
    console.warn('[posthog-server] capture failed:', err)
  }
}
