import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, Zap, Package, DollarSign } from 'lucide-react'
import type { DbSkill } from '@/lib/db-types'

type SaleRow = {
  id: string
  created_at: string
  amount_paid: number
  buyer_id: string
  skill_id: string
  skills: {
    name: string
    price_gbp: number
  } | null
}

export default async function EarningsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch profile (has total_earned)
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, total_earned, commission_rate')
    .eq('id', user.id)
    .single()

  // Fetch seller's listed skills
  const { data: skillsData } = await supabase
    .from('skills')
    .select('id, name, price_gbp, total_acquisitions, description, is_active, pricing_model')
    .eq('seller_id', user.id)
    .order('total_acquisitions', { ascending: false })

  const skills: DbSkill[] = (skillsData as DbSkill[] | null) ?? []
  const skillIds = skills.map(s => s.id)

  // Fetch recent sales for this seller's skills
  let recentSales: SaleRow[] = []
  if (skillIds.length > 0) {
    const { data: salesData } = await supabase
      .from('acquisitions')
      .select('id, created_at, amount_paid, buyer_id, skill_id, skills(name, price_gbp)')
      .in('skill_id', skillIds)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(20)

    recentSales = (salesData as SaleRow[] | null) ?? []
  }

  // Compute totals
  const totalEarned = parseFloat(profile?.total_earned ?? '0') || 0
  const totalSales = skills.reduce((sum, s) => sum + (s.total_acquisitions ?? 0), 0)
  const commissionRate = profile?.commission_rate ?? 25

  const pricingLabel = (model: string) => ({ one_time: 'One-time', subscription: '/mo', per_use: '/use' })[model] ?? ''

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-5xl mx-auto">

        {/* Back link */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-[#8892a4] hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-green-400" />
            <span className="text-sm text-[#8892a4]">Seller Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Earnings</h1>
          <p className="text-sm text-[#8892a4] mt-1">
            Platform takes {commissionRate}% commission — you keep {100 - commissionRate}%
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5">
            <div className="flex items-center gap-2 text-[#8892a4] text-xs mb-2">
              <DollarSign className="w-4 h-4 text-green-400" />
              Total Earnings
            </div>
            <div className="text-3xl font-bold text-white">
              £{totalEarned.toFixed(2)}
            </div>
            <div className="text-xs text-[#8892a4] mt-1">After platform commission</div>
          </div>

          <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5">
            <div className="flex items-center gap-2 text-[#8892a4] text-xs mb-2">
              <Zap className="w-4 h-4 text-blue-400" />
              Total Sales
            </div>
            <div className="text-3xl font-bold text-white">
              {totalSales.toLocaleString()}
            </div>
            <div className="text-xs text-[#8892a4] mt-1">Across all skills</div>
          </div>

          <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-5">
            <div className="flex items-center gap-2 text-[#8892a4] text-xs mb-2">
              <Package className="w-4 h-4 text-purple-400" />
              Skills Listed
            </div>
            <div className="text-3xl font-bold text-white">
              {skills.length}
            </div>
            <div className="text-xs text-[#8892a4] mt-1">
              {skills.filter(s => s.is_active).length} active
            </div>
          </div>
        </div>

        {/* Skills Table */}
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-white mb-4">My Skills</h2>

          {skills.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-12 text-center">
              <Package className="w-10 h-10 text-[#4a5568] mx-auto mb-3" />
              <p className="text-[#8892a4] mb-4">You haven&apos;t listed any skills yet.</p>
              <Link
                href="/list"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#1e2535] text-sm text-[#8892a4] hover:text-white hover:border-blue-500/50 transition-all"
              >
                List your first skill
              </Link>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2535]">
                    <th className="text-left px-5 py-3 text-[#8892a4] font-medium">Skill</th>
                    <th className="text-right px-5 py-3 text-[#8892a4] font-medium">Price</th>
                    <th className="text-right px-5 py-3 text-[#8892a4] font-medium">Sales</th>
                    <th className="text-right px-5 py-3 text-[#8892a4] font-medium">Gross Revenue</th>
                    <th className="text-right px-5 py-3 text-[#8892a4] font-medium">Your Earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {skills.map((skill, i) => {
                    const grossRevenue = skill.price_gbp * (skill.total_acquisitions ?? 0)
                    const yourEarnings = grossRevenue * ((100 - commissionRate) / 100)
                    return (
                      <tr
                        key={skill.id}
                        className={`border-b border-[#1e2535] last:border-0 hover:bg-[#0f1520] transition-colors ${i % 2 === 0 ? '' : 'bg-[#0a0e17]/50'}`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div>
                              <Link
                                href={`/skill/${skill.id}`}
                                className="font-medium text-white hover:text-blue-400 transition-colors"
                              >
                                {skill.name}
                              </Link>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${skill.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {skill.is_active ? 'Active' : 'Inactive'}
                                </span>
                                <span className="text-xs text-[#4a5568]">{pricingLabel(skill.pricing_model)}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right text-white font-medium">
                          £{skill.price_gbp.toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-white font-medium">{(skill.total_acquisitions ?? 0).toLocaleString()}</span>
                        </td>
                        <td className="px-5 py-4 text-right text-[#8892a4]">
                          £{grossRevenue.toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-green-400 font-semibold">£{yourEarnings.toFixed(2)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-[#1e2535] bg-[#0a0e17]/50">
                    <td className="px-5 py-3 text-[#8892a4] text-xs font-medium" colSpan={2}>Totals</td>
                    <td className="px-5 py-3 text-right text-white font-semibold">{totalSales.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-[#8892a4]">
                      £{skills.reduce((s, sk) => s + sk.price_gbp * (sk.total_acquisitions ?? 0), 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-right text-green-400 font-bold">
                      £{totalEarned.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Recent Sales */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Sales</h2>

          {recentSales.length === 0 ? (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-12 text-center">
              <Zap className="w-10 h-10 text-[#4a5568] mx-auto mb-3" />
              <p className="text-[#8892a4]">No sales yet. Once buyers acquire your skills, they&apos;ll appear here.</p>
            </div>
          ) : (
            <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1e2535]">
                    <th className="text-left px-5 py-3 text-[#8892a4] font-medium">Date</th>
                    <th className="text-left px-5 py-3 text-[#8892a4] font-medium">Skill</th>
                    <th className="text-right px-5 py-3 text-[#8892a4] font-medium">Amount Paid</th>
                    <th className="text-right px-5 py-3 text-[#8892a4] font-medium">Your Cut</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSales.map((sale, i) => {
                    const amountPaid = typeof sale.amount_paid === 'number' ? sale.amount_paid : parseFloat(String(sale.amount_paid)) || 0
                    const yourCut = amountPaid * ((100 - commissionRate) / 100)
                    return (
                      <tr
                        key={sale.id}
                        className={`border-b border-[#1e2535] last:border-0 hover:bg-[#0f1520] transition-colors ${i % 2 === 0 ? '' : 'bg-[#0a0e17]/50'}`}
                      >
                        <td className="px-5 py-4 text-[#8892a4] whitespace-nowrap">
                          {new Date(sale.created_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-white font-medium">
                            {sale.skills?.name ?? 'Unknown Skill'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right text-[#8892a4]">
                          £{amountPaid.toFixed(2)}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="text-green-400 font-semibold">£{yourCut.toFixed(2)}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {recentSales.length === 20 && (
                <div className="px-5 py-3 border-t border-[#1e2535] text-center text-xs text-[#4a5568]">
                  Showing last 20 sales
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
