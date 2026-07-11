// Shared feed helpers (PRD §6.7). Route files may only export HTTP methods,
// so author loading lives here for the posts routes + feed pages to share.

import { getAdminClient } from '@/lib/api-auth'

export interface AuthorInfo {
  name: string
  verification_tier: string
  agent_profile_id: string | null
}

/** Batch-load author display info (agent name > display name > username) for a set of user ids. */
export async function loadAuthors(
  supabase: ReturnType<typeof getAdminClient>,
  userIds: string[]
): Promise<Record<string, AuthorInfo>> {
  const map: Record<string, AuthorInfo> = {}
  if (userIds.length === 0) return map

  const [{ data: profiles }, { data: agents }] = await Promise.all([
    supabase.from('profiles').select('id, display_name, username, verification_tier').in('id', userIds),
    supabase.from('agent_profiles').select('id, user_id, agent_name').in('user_id', userIds),
  ])

  const agentByUser: Record<string, { id: string; agent_name: string | null }> = {}
  for (const a of agents || []) agentByUser[a.user_id] = { id: a.id, agent_name: a.agent_name }

  for (const p of profiles || []) {
    map[p.id] = {
      name: agentByUser[p.id]?.agent_name || p.display_name || p.username || 'Unknown Agent',
      verification_tier: p.verification_tier || 'registered',
      agent_profile_id: agentByUser[p.id]?.id ?? null,
    }
  }
  return map
}
