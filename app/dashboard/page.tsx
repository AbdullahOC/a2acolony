import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Bot, Plus, Package, LogOut, Zap, Star, ArrowRight } from 'lucide-react'
import type { DbSkill, DbAcquisition } from '@/lib/db-types'
import { CATEGORIES } from '@/lib/placeholder-data'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch skills the user has listed
  const { data: listedSkillsData } = await supabase
    .from('skills')
    .select('*')
    .eq('seller_id', user.id)
    .order('created_at', { ascending: false })

  const listedSkills: DbSkill[] = (listedSkillsData as DbSkill[] | null) ?? []

  // Fetch skills the user has acquired (join acquisitions → skills)
  const { data: acquisitionsData } = await supabase
    .from('acquisitions')
    .select('*, skills(*)')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })

  const acquisitions: DbAcquisition[] = (acquisitionsData as DbAcquisition[] | null) ?? []

  // Compute stats
  const totalAcquisitions = listedSkills.reduce((sum, s) => sum + (s.total_acquisitions ?? 0), 0)
  const ratingsWithValues = listedSkills.filter(s => s.rating !== null && s.rating > 0)
  const avgRating = ratingsWithValues.length > 0
    ? (ratingsWithValues.reduce((sum, s) => sum + (s.rating ?? 0), 0) / ratingsWithValues.length).toFixed(1)
    : '—'

  const displayName = profile?.username || user.user_metadata?.username || user.email?.split('@')[0]

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bot className="w-5 h-5 text-blue-400" />
              <span className="text-sm text-[#8892a4]">Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              Welcome, <span className="text-blue-400">{displayName}</span>
            </h1>
            <p className="text-sm text-[#8892a4] mt-1">{user.email}</p>
          </div>
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="border-[#1e2535] text-[#8892a4] hover:text-white gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </form>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Skills Listed', value: listedSkills.length.toString(), icon: <Package className="w-4 h-4" /> },
            { label: 'Total Acquisitions', value: totalAcquisitions.toLocaleString(), icon: <Zap className="w-4 h-4" /> },
            { label: 'Skills Acquired', value: acquisitions.length.toString(), icon: <ArrowRight className="w-4 h-4" /> },
            { label: 'Avg Rating', value: avgRating, icon: <Star className="w-4 h-4" /> },
          ].map(stat => (
            <div key={stat.label} className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-4">
              <div className="flex items-center gap-2 text-[#8892a4] text-xs mb-2">
                {stat.icon}
                {stat.label}
              </div>
              <div className="text-2xl font-bold text-white">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Your Listed Skills */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Your Listed Skills</h2>
            <Link href="/list">
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white gap-2">
                <Plus className="w-4 h-4" />
                List a Skill
              </Button>
            </Link>
          </div>

          {listedSkills.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-12 text-center">
              <Package className="w-10 h-10 text-[#4a5568] mx-auto mb-3" />
              <p className="text-[#8892a4] mb-4">You haven&apos;t listed any skills yet.</p>
              <Link href="/list">
                <Button size="sm" variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white">
                  List your first skill
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {listedSkills.map(skill => {
                const category = CATEGORIES.find(c => c.id === skill.category)
                const pricingLabel = { one_time: 'One-time', subscription: '/mo', per_use: '/use' }[skill.pricing_model]
                return (
                  <Link key={skill.id} href={`/skill/${skill.id}`}>
                    <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5 hover:border-blue-500/50 transition-all flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {category && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${category.color}`}>
                              {category.icon} {category.label}
                            </span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            skill.is_active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-red-500/20 text-red-400'
                          }`}>
                            {skill.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <h3 className="font-medium text-white truncate">{skill.name}</h3>
                        <p className="text-xs text-[#8892a4] mt-0.5 line-clamp-1">{skill.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-white text-sm">£{skill.price_gbp}{pricingLabel}</div>
                        <div className="text-xs text-[#8892a4] mt-0.5">
                          <span className="flex items-center gap-1 justify-end">
                            <Zap className="w-3 h-3 text-blue-400" />
                            {skill.total_acquisitions.toLocaleString()} acquired
                          </span>
                        </div>
                        {skill.rating !== null && skill.rating > 0 && (
                          <div className="text-xs text-[#8892a4] flex items-center gap-1 justify-end mt-0.5">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            {skill.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Acquired Skills */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Acquired Skills</h2>

          {acquisitions.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-12 text-center">
              <Zap className="w-10 h-10 text-[#4a5568] mx-auto mb-3" />
              <p className="text-[#8892a4] mb-4">You haven&apos;t acquired any skills yet.</p>
              <Link href="/browse">
                <Button size="sm" variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white">
                  Browse the marketplace
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-3">
              {acquisitions.map(acq => {
                const skill = acq.skills
                if (!skill) return null
                const category = CATEGORIES.find(c => c.id === skill.category)
                const pricingLabel = { one_time: 'One-time', subscription: '/mo', per_use: '/use' }[skill.pricing_model]
                return (
                  <Link key={acq.id} href={`/skill/${skill.id}`}>
                    <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5 hover:border-blue-500/50 transition-all flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {category && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${category.color}`}>
                              {category.icon} {category.label}
                            </span>
                          )}
                          <span className="text-xs text-green-400 bg-green-500/20 px-2 py-0.5 rounded-full">Acquired</span>
                        </div>
                        <h3 className="font-medium text-white truncate">{skill.name}</h3>
                        <p className="text-xs text-[#8892a4] mt-0.5 line-clamp-1">{skill.description}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-white text-sm">£{skill.price_gbp}{pricingLabel}</div>
                        <div className="text-xs text-[#8892a4] mt-0.5">
                          {new Date(acq.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
