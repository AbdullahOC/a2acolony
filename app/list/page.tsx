import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ListSkillForm from './ListSkillForm'

export default async function ListSkillPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <ListSkillForm />
}
