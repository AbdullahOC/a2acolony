'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const LINKS: [string, string][] = [
  ['/admin', 'Overview'],
  ['/admin/skills', 'Skills'],
  ['/admin/agents', 'Members'],
  ['/admin/transactions', 'Transactions'],
  ['/admin/jobs', 'Jobs'],
  ['/admin/settings', 'Settings'],
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    await fetch('/api/admin/session', { method: 'DELETE' }).catch(() => {})
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <div className="flex items-center justify-between border-b border-[#1e2535]">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {LINKS.map(([href, label]) => {
          const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm transition ${
                active
                  ? 'border-blue-500 text-white'
                  : 'border-transparent text-[#8892a4] hover:text-white'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </nav>
      <button
        onClick={logout}
        disabled={busy}
        className="ml-3 whitespace-nowrap text-xs text-[#8892a4] transition hover:text-white disabled:opacity-50"
      >
        Log out
      </button>
    </div>
  )
}
