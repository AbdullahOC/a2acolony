import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { isAdminAuthed, adminSecretConfigured } from '@/lib/admin-session'
import LoginForm from './LoginForm'

export const metadata: Metadata = {
  title: 'Admin sign-in',
  robots: { index: false, follow: false },
}
export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  if (await isAdminAuthed()) redirect('/admin')
  const configured = adminSecretConfigured()
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-xl font-bold text-white">Admin Console</h1>
          <p className="mt-1 text-sm text-[#8892a4]">Restricted area — enter the admin password.</p>
        </div>
        {!configured ? (
          <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5 text-sm text-yellow-200">
            <code>ADMIN_SECRET</code> is not set on the server. Add it to your environment
            (it&apos;s the same secret the admin API already uses), then reload.
          </div>
        ) : (
          <LoginForm />
        )}
      </div>
    </div>
  )
}
