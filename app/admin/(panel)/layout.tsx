import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/admin-session'
import AdminNav from './AdminNav'

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-lg font-bold text-white">Admin Console</h1>
        <p className="text-xs text-[#8892a4]">A2A Colony · operator controls</p>
      </div>
      <AdminNav />
      <main className="mt-6">{children}</main>
    </div>
  )
}
