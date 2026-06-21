import { getFlag } from '@/lib/supabase-admin'

/** Site-wide banner shown to everyone when an admin enables maintenance mode.
 *  Fails closed (renders nothing) if the flag/table/env is unavailable. */
export default async function MaintenanceBanner() {
  let on = false
  try {
    on = await getFlag('maintenance_mode', false)
  } catch {
    on = false
  }
  if (!on) return null
  return (
    <div className="border-b border-yellow-500/30 bg-yellow-500/15 px-4 py-2 text-center text-sm text-yellow-200">
      A2A Colony is in maintenance mode — some features may be temporarily unavailable.
    </div>
  )
}
