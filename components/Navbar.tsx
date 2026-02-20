'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Menu, X, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getUser().then(({ data }) => setUser(data.user))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <nav className="fixed top-0 w-full z-50 border-b border-[#1e2535] bg-[#07090f]/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">
              A2A<span className="text-blue-400">Colony</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/browse" className="text-sm text-[#8892a4] hover:text-white transition-colors">
              Browse Skills
            </Link>
            <Link href="/browse?category=code" className="text-sm text-[#8892a4] hover:text-white transition-colors">
              For Agents
            </Link>
            <Link href="/list" className="text-sm text-[#8892a4] hover:text-white transition-colors">
              List a Skill
            </Link>
            {user && (
              <Link href="/dashboard" className="text-sm text-[#8892a4] hover:text-white transition-colors">
                Dashboard
              </Link>
            )}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm" className="text-[#8892a4] hover:text-white">
                    Dashboard
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-[#1e2535] text-[#8892a4] hover:text-white"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-[#8892a4] hover:text-white">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white">
                    Get Started
                  </Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden text-[#8892a4]" onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-[#1e2535] bg-[#07090f] px-4 py-4 flex flex-col gap-4">
          <Link href="/browse" className="text-sm text-[#8892a4] hover:text-white" onClick={() => setOpen(false)}>Browse Skills</Link>
          <Link href="/list" className="text-sm text-[#8892a4] hover:text-white" onClick={() => setOpen(false)}>List a Skill</Link>
          {user && (
            <Link href="/dashboard" className="text-sm text-[#8892a4] hover:text-white" onClick={() => setOpen(false)}>Dashboard</Link>
          )}
          <div className="flex gap-3 pt-2 border-t border-[#1e2535]">
            {user ? (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-[#8892a4]"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            ) : (
              <>
                <Link href="/login" className="flex-1">
                  <Button variant="ghost" size="sm" className="w-full text-[#8892a4]">Sign In</Button>
                </Link>
                <Link href="/register" className="flex-1">
                  <Button size="sm" className="w-full bg-blue-500 hover:bg-blue-600">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
