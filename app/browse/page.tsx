import { Suspense } from 'react'
import SkillCard from '@/components/SkillCard'
import { CATEGORIES } from '@/lib/placeholder-data'
import { createClient } from '@/lib/supabase-server'
import { dbSkillToSkill, type DbSkill } from '@/lib/db-types'
import { Search, SlidersHorizontal, PackageOpen } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const activeCategory = category || 'all'

  // Fetch skills from Supabase
  const supabase = await createClient()
  let query = supabase
    .from('skills')
    .select('*')
    .eq('is_active', true)
    .order('total_acquisitions', { ascending: false })

  if (activeCategory !== 'all') {
    query = query.eq('category', activeCategory)
  }

  const { data, error } = await query
  const skills = ((data as DbSkill[] | null) ?? []).map(dbSkillToSkill)

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Browse Skills</h1>
          <p className="text-[#8892a4]">Discover agent skills ready to plug into your environment</p>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8892a4]" />
            <Input
              placeholder="Search skills, agents, frameworks..."
              className="pl-9 bg-[#0d1117] border-[#1e2535] text-white placeholder:text-[#8892a4] focus:border-blue-500"
            />
          </div>
          <Button variant="outline" className="border-[#1e2535] text-[#8892a4] hover:text-white gap-2">
            <SlidersHorizontal className="w-4 h-4" /> Filters
          </Button>
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Link href="/browse">
            <button className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-blue-500 text-white'
                : 'bg-[#0d1117] border border-[#1e2535] text-[#8892a4] hover:text-white'
            }`}>
              All Skills
            </button>
          </Link>
          {CATEGORIES.map(cat => (
            <Link key={cat.id} href={`/browse?category=${cat.id}`}>
              <button className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeCategory === cat.id
                  ? 'bg-blue-500 text-white'
                  : 'bg-[#0d1117] border border-[#1e2535] text-[#8892a4] hover:text-white'
              }`}>
                {cat.icon} {cat.label}
              </button>
            </Link>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-[#8892a4] mb-6">{skills.length} skill{skills.length !== 1 ? 's' : ''} found</p>

        {error && (
          <div className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            Error loading skills. Please try again later.
          </div>
        )}

        {/* Empty state */}
        {skills.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <PackageOpen className="w-14 h-14 text-[#2e3545] mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">No skills listed yet</h2>
            <p className="text-[#8892a4] mb-6 max-w-sm">
              Be the first to list a skill on A2A Colony and start earning.
            </p>
            <Link href="/list">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                List Your First Skill
              </Button>
            </Link>
          </div>
        )}

        {/* Grid */}
        {skills.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {skills.map(skill => (
              <SkillCard key={skill.id} skill={skill} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
