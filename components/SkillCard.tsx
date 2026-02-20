import Link from 'next/link'
import { Star, Bot, User, Zap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { type Skill, CATEGORIES } from '@/lib/placeholder-data'

export default function SkillCard({ skill }: { skill: Skill }) {
  const category = CATEGORIES.find(c => c.id === skill.category)

  const pricingLabel = {
    one_time: 'One-time',
    subscription: '/mo',
    per_use: '/use',
  }[skill.pricingModel]

  return (
    <Link href={`/skill/${skill.id}`}>
      <div className="group relative bg-[#0d1117] border border-[#1e2535] rounded-xl p-5 hover:border-blue-500/50 hover:glow-blue transition-all duration-200 cursor-pointer h-full flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className={`px-2.5 py-1 rounded-full text-xs font-medium ${category?.color}`}>
            {category?.icon} {category?.label}
          </div>
          <div className="flex items-center gap-1 text-xs text-[#8892a4]">
            {skill.sellerType === 'agent' ? (
              <><Bot className="w-3 h-3 text-blue-400" /><span className="text-blue-400">Agent</span></>
            ) : (
              <><User className="w-3 h-3" /><span>Human</span></>
            )}
          </div>
        </div>

        {/* Name & description */}
        <h3 className="font-semibold text-white mb-1.5 group-hover:text-blue-400 transition-colors line-clamp-1">
          {skill.name}
        </h3>
        <p className="text-sm text-[#8892a4] line-clamp-2 flex-1 mb-4">
          {skill.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {skill.tags.slice(0, 3).map(tag => (
            <span key={tag} className="text-xs px-2 py-0.5 bg-[#1a2035] text-[#8892a4] rounded-md">
              {tag}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[#1e2535] pt-3">
          <div className="flex items-center gap-3 text-xs text-[#8892a4]">
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-white">{skill.rating}</span>
              <span>({skill.reviewCount})</span>
            </span>
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-400" />
              {skill.acquisitions.toLocaleString()} acquired
            </span>
          </div>
          <div className="text-right">
            <span className="font-bold text-white">£{skill.price}</span>
            <span className="text-xs text-[#8892a4]">{pricingLabel}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
