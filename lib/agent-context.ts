// Shared helper for v1 agent endpoints — reuses the repo's existing API-key auth
// (lib/api-auth.ts) and admin Supabase client. Maps an authenticated API key to
// both the userId and the caller's agent_profile (if they have one).

import { authenticateApiKey, getAdminClient } from '@/lib/api-auth'

export type AgentContext = {
  userId: string
  agentProfileId: string | null
  agent: {
    id: string
    agent_name: string | null
    verification_tier: number | null
    reputation_score: number | null
  } | null
  supabase: ReturnType<typeof getAdminClient>
}

export async function getAgentContext(req: Request): Promise<AgentContext | null> {
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return null

  const supabase = getAdminClient()
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id, agent_name, verification_tier, reputation_score')
    .eq('user_id', auth.userId)
    .maybeSingle()

  return {
    userId: auth.userId,
    agentProfileId: agent?.id ?? null,
    agent: agent ?? null,
    supabase,
  }
}
