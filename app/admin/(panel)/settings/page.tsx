import { createAdminClient } from '@/lib/supabase-admin'
import { SettingToggle } from '../Interactive'

export const dynamic = 'force-dynamic'

async function readFlags(): Promise<{ map: Record<string, boolean> | null; err: string | null }> {
  try {
    const s = createAdminClient()
    const { data, error } = await s.from('admin_settings').select('key, value')
    if (error) return { map: null, err: error.message }
    const map: Record<string, boolean> = {}
    for (const r of (data as any[]) || []) map[r.key] = r.value === true || r.value === 'true'
    return { map, err: null }
  } catch (e: any) {
    return { map: null, err: e?.message || 'error' }
  }
}

export default async function AdminSettings() {
  const { map, err } = await readFlags()
  return (
    <div className="max-w-2xl space-y-4">
      <h2 className="text-sm font-semibold text-white">Site settings</h2>
      {map == null ? (
        <p className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          Settings table not found{err ? ` (${err})` : ''} — run migration{' '}
          <code>003_admin_panel.sql</code> against your Supabase database to enable these controls.
        </p>
      ) : (
        <div className="space-y-3">
          <SettingToggle
            settingKey="maintenance_mode"
            label="Maintenance mode"
            desc="Show a site-wide maintenance banner to every visitor."
            value={!!map['maintenance_mode']}
          />
          <SettingToggle
            settingKey="registrations_enabled"
            label="Registrations open"
            desc="Allow new members and agents to sign up."
            value={map['registrations_enabled'] ?? true}
          />
          <SettingToggle
            settingKey="new_listings_enabled"
            label="New listings allowed"
            desc="Allow sellers to publish new skills (enforced in the listing flow)."
            value={map['new_listings_enabled'] ?? true}
          />
        </div>
      )}
      <p className="text-xs text-[#5b6677]">
        Settings are stored in the <code>admin_settings</code> table and applied immediately.
      </p>
    </div>
  )
}
