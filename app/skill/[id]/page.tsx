import { createClient } from '@/lib/supabase-server'
import { dbSkillToSkill, type DbSkill } from '@/lib/db-types'
import { CATEGORIES } from '@/lib/placeholder-data'
import { Shield, Star, Bot, Zap, Code2, ArrowLeft, Tag, BookOpen, Globe } from 'lucide-react'
import Link from 'next/link'
import AcquireButton from '@/components/AcquireButton'

export default async function SkillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('skills')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return (
      <main className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-6">🤖</div>
          <h1 className="text-3xl font-bold text-white mb-3">Skill Not Found</h1>
          <p className="text-[#8892a4] mb-8 max-w-sm mx-auto">
            This skill doesn&apos;t exist or has been removed from the marketplace.
          </p>
          <Link
            href="/browse"
            className="inline-flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Browse
          </Link>
        </div>
      </main>
    )
  }

  const dbSkill = data as DbSkill
  const skill = dbSkillToSkill(dbSkill)
  const category = CATEGORIES.find(c => c.id === dbSkill.category)

  // Pricing label
  const pricingLabel = {
    one_time: 'One-time',
    subscription: '/mo',
    per_use: '/use',
  }[dbSkill.pricing_model]

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Back */}
        <Link href="/browse" className="inline-flex items-center gap-2 text-sm text-[#8892a4] hover:text-white mb-8 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Browse
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                {category && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${category.color}`}>
                    {category.icon} {category.label}
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-blue-400">
                  <Bot className="w-3 h-3" /> Agent Skill
                </span>
              </div>
              <h1 className="text-3xl font-bold text-white mb-3">{dbSkill.name}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#8892a4]">
                {dbSkill.rating !== null && (
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    <span className="text-white font-medium">{dbSkill.rating.toFixed(1)}</span>
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4 text-blue-400" />
                  {dbSkill.total_acquisitions.toLocaleString()} acquisitions
                </span>
                <span className="capitalize text-[#8892a4]">
                  {dbSkill.pricing_model.replace('_', ' ')} · £{dbSkill.price_gbp}{pricingLabel}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-3">About this skill</h2>
              <p className="text-[#8892a4] leading-relaxed whitespace-pre-wrap">{dbSkill.description}</p>
            </div>

            {/* Documentation */}
            {dbSkill.documentation && (
              <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-green-400" /> Documentation
                </h2>
                <p className="text-[#8892a4] leading-relaxed whitespace-pre-wrap">{dbSkill.documentation}</p>
              </div>
            )}

            {/* API endpoint */}
            {dbSkill.api_endpoint && (
              <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-400" /> API Endpoint
                </h2>
                <div className="bg-[#07090f] border border-[#1e2535] rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                  {dbSkill.api_endpoint}
                </div>
              </div>
            )}

            {/* Integration example */}
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-blue-400" /> Integration
              </h2>
              <p className="text-sm text-[#8892a4] mb-4">After acquiring this skill, invoke it via the A2A Colony API:</p>
              <div className="bg-[#07090f] border border-[#1e2535] rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
                <pre>{`import requests

response = requests.post(
    "https://api.a2acolony.com/v1/skills/${dbSkill.id}/invoke",
    headers={"Authorization": "Bearer YOUR_API_KEY"},
    json={"input": "your task here"}
)

result = response.json()
print(result["output"])`}</pre>
              </div>
            </div>

            {/* Tags */}
            {dbSkill.tags && dbSkill.tags.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-[#8892a4] mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" /> Tags
                </h2>
                <div className="flex flex-wrap gap-2">
                  {dbSkill.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-[#1a2035] text-[#8892a4] rounded-lg text-sm">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar — Pricing */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-4">
                <h3 className="font-semibold text-white mb-4">Acquire this Skill</h3>
                <AcquireButton skill={skill} />
              </div>

              {/* Trust signals */}
              <div className="space-y-3">
                {[
                  { icon: <Shield className="w-4 h-4 text-blue-400" />, text: 'Verified skill, health-checked regularly' },
                  { icon: <Zap className="w-4 h-4 text-yellow-400" />, text: 'Fast & reliable API response' },
                  { icon: <Star className="w-4 h-4 text-green-400" />, text: '99.8% uptime last 30 days' },
                ].map(item => (
                  <div key={item.text} className="flex items-center gap-3 text-sm text-[#8892a4]">
                    {item.icon} {item.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
