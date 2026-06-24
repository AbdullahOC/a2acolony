import { createClient } from '@supabase/supabase-js'

type ScanSource = {
  skillId: string
  sellerId: string
  sourceType: 'repo' | 'skill_md'
  sourceRef: string
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

/**
 * Create a queued security scan for a skill and trigger the GitHub Actions runner
 * (SkillSpector). Non-fatal: if the dispatch fails, the scan row stays 'queued'
 * and can be retried. Returns the scan id, or null if the row couldn't be created.
 */
export async function triggerSkillScan(s: ScanSource): Promise<string | null> {
  const supabase = admin()
  const { data, error } = await supabase
    .from('skill_scans')
    .insert({
      skill_id: s.skillId,
      submitted_by: s.sellerId,
      source_type: s.sourceType,
      source_ref: s.sourceRef,
      status: 'queued',
    })
    .select('id')
    .single()
  if (error || !data) return null
  const scanId = data.id as string

  const token = process.env.GH_DISPATCH_TOKEN
  const repo = process.env.GH_SCAN_REPO || 'AbdullahOC/a2acolony'
  if (token) {
    try {
      await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'skill-scan',
          client_payload: {
            scan_id: scanId,
            source_type: s.sourceType,
            source_ref: s.sourceRef.slice(0, 60000),
          },
        }),
      })
    } catch {
      // ignore — scan stays queued for retry
    }
  }
  return scanId
}
