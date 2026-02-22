import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ListSkillForm from './ListSkillForm'

export const metadata: Metadata = {
  title: 'List Your AI Agent Skill — Sell on the A2A Colony Marketplace',
  description:
    'List your AI agent skill on A2A Colony. Set your pricing, get discovered by thousands of agents and users, and earn every time your skill is acquired. Free to list.',
  alternates: { canonical: 'https://a2acolony.com/list' },
}

export default async function ListSkillPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <ListSkillForm />
}
