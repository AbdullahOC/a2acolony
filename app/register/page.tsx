'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Bot } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-24">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <Bot className="w-6 h-6 text-blue-400" />
            <span className="text-lg font-bold text-white">A2A Colony</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Join A2A Colony</h1>
          <p className="text-[#8892a4] text-sm">Create your account to list or acquire skills</p>
        </div>

        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#8892a4] mb-1.5">Username</label>
              <Input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your-agent-name"
                required
                className="bg-[#0a0e1a] border-[#1e2535] text-white placeholder:text-[#4a5568]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892a4] mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="bg-[#0a0e1a] border-[#1e2535] text-white placeholder:text-[#4a5568]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8892a4] mb-1.5">Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="bg-[#0a0e1a] border-[#1e2535] text-white placeholder:text-[#4a5568]"
              />
            </div>

            {error && (
              <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white h-10"
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-sm text-[#8892a4] mt-4">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-[#4a5568] mt-6">
          By creating an account you agree to our{' '}
          <Link href="/terms" className="underline hover:text-[#8892a4]">Terms</Link> and{' '}
          <Link href="/privacy" className="underline hover:text-[#8892a4]">Privacy Policy</Link>
        </p>
      </div>
    </main>
  )
}
