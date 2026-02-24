import { NextRequest } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { sha256 } from '@/lib/api-auth'
import { apiSuccess, apiError, handleCors } from '@/lib/api-helpers'
import { captureServerEvent } from '@/lib/posthog-server'

export async function OPTIONS() {
  return handleCors()
}

/**
 * POST /api/v1/agents/register
 *
 * Allows an AI agent to self-register and receive an API key without any
 * human involvement. No email confirmation required.
 *
 * Body: { username, email, password? }
 * Returns: { agent_id, api_key, username, message }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null)
    if (!body) {
      return apiError('Request body required', 'BAD_REQUEST', 400)
    }

    const { username, email, password } = body

    if (!username?.trim()) return apiError('username is required', 'BAD_REQUEST', 400)
    if (!email?.trim()) return apiError('email is required', 'BAD_REQUEST', 400)

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return apiError('Invalid email format', 'BAD_REQUEST', 400)
    }

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Generate a secure random password if not provided
    const agentPassword = password || Array.from(
      crypto.getRandomValues(new Uint8Array(24)),
      b => b.toString(36)
    ).join('').slice(0, 32)

    // Create user via admin API — bypasses email confirmation
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: agentPassword,
      email_confirm: true,
      user_metadata: {
        username: username.trim(),
        account_type: 'agent',
      },
    })

    if (authError) {
      if (authError.message.includes('already registered') || authError.message.includes('already been registered')) {
        return apiError('An account with this email already exists', 'CONFLICT', 409)
      }
      return apiError(authError.message, 'AUTH_ERROR', 400)
    }

    const user = authData.user
    if (!user) return apiError('Failed to create user', 'INTERNAL_ERROR', 500)

    // Create profile (is_agent = true)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        username: username.trim(),
        email: email.trim().toLowerCase(),
        is_agent: true,
        commission_rate: 10,
      })

    if (profileError) {
      // Clean up the auth user if profile creation fails
      await supabase.auth.admin.deleteUser(user.id)
      return apiError('Failed to create agent profile', 'DB_ERROR', 500)
    }

    // Generate API key
    const randomBytes = new Uint8Array(32)
    crypto.getRandomValues(randomBytes)
    const keyBody = Array.from(randomBytes).map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 40)
    const apiKey = `a2a_live_${keyBody}`
    const keyHash = await sha256(apiKey)
    const keyPrefix = apiKey.slice(0, 13)

    const { error: keyError } = await supabase
      .from('agent_api_keys')
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        name: `${username} default key`,
      })

    if (keyError) {
      return apiError('Failed to create API key', 'DB_ERROR', 500)
    }

    // Analytics: agent registered
    await captureServerEvent(user.id, 'agent_registered', {
      agent_id: user.id,
      username: username.trim(),
      account_type: 'agent',
    })

    return apiSuccess({
      agent_id: user.id,
      api_key: apiKey,
      username: username.trim(),
      email: email.trim().toLowerCase(),
      credits_gbp: 0,
      message: 'Agent registered. Save your api_key — it will not be shown again. Top up your wallet to start purchasing skills.',
    }, 201)

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return apiError(message, 'INTERNAL_ERROR', 500)
  }
}
