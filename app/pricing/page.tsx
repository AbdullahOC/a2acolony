import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Pricing — A2A Colony | Sell AI Agent Skills',
  description:
    'Simple, transparent pricing for AI agent skill sellers. Pay-as-you-go at 25% commission, or subscribe for £19.99/month and keep 90% of every sale.',
  alternates: { canonical: 'https://a2acolony.com/pricing' },
}

const tiers = [
  {
    name: 'Pay As You Go',
    price: 'Free to start',
    sub: 'No monthly fee',
    commission: '25%',
    commissionLabel: 'per transaction',
    description: 'Perfect for sellers just getting started. List your skills with no upfront cost — we only earn when you do.',
    features: [
      'Unlimited skill listings',
      'Instant marketplace access',
      'Card & crypto payments',
      'Weekly manual payouts',
      'Basic analytics',
      'A2A Protocol discovery',
    ],
    cta: 'Start listing for free',
    ctaHref: '/register',
    highlight: false,
  },
  {
    name: 'Seller Subscription',
    price: '£19.99',
    sub: 'per month',
    commission: '10%',
    commissionLabel: 'per transaction',
    description: 'For serious sellers. Cut your commission in half and keep more of every sale. Pays for itself at £200/month in sales.',
    features: [
      'Everything in Pay As You Go',
      'Only 10% commission (vs 25%)',
      'Priority listing placement',
      'Advanced analytics dashboard',
      'Featured seller badge',
      'Early access to new features',
    ],
    cta: 'Subscribe & save',
    ctaHref: '/subscribe',
    highlight: true,
  },
]

function CheckIcon() {
  return (
    <svg className="w-5 h-5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0f] pt-24 pb-20">
      {/* Header */}
      <div className="max-w-4xl mx-auto px-6 text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Simple, transparent pricing
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          We only make money when you make money. Choose the model that works for you.
        </p>
      </div>

      {/* Tiers */}
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-8 mb-16">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-2xl border p-8 flex flex-col ${
              tier.highlight
                ? 'border-blue-500 bg-blue-500/5'
                : 'border-white/10 bg-white/5'
            }`}
          >
            {tier.highlight && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <span className="bg-blue-500 text-white text-sm font-semibold px-4 py-1 rounded-full">
                  Most popular
                </span>
              </div>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold text-white mb-1">{tier.name}</h2>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-4xl font-bold text-white">{tier.price}</span>
                <span className="text-gray-400 text-sm">{tier.sub}</span>
              </div>
              <div className="flex items-baseline gap-1 mb-4">
                <span className={`text-2xl font-bold ${tier.highlight ? 'text-blue-400' : 'text-gray-300'}`}>
                  {tier.commission}
                </span>
                <span className="text-gray-500 text-sm">{tier.commissionLabel}</span>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed">{tier.description}</p>
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckIcon />
                  {feature}
                </li>
              ))}
            </ul>

            <Link
              href={tier.ctaHref}
              className={`block text-center py-3 px-6 rounded-xl font-semibold transition-all ${
                tier.highlight
                  ? 'bg-blue-500 hover:bg-blue-400 text-white'
                  : 'border border-white/20 hover:border-white/40 text-white hover:bg-white/5'
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>

      {/* Break-even callout */}
      <div className="max-w-3xl mx-auto px-6 mb-16">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8">
          <h3 className="text-lg font-bold text-white mb-4">When does the subscription pay off?</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-white/10">
                  <th className="text-left pb-3">Monthly sales</th>
                  <th className="text-right pb-3">PAYG cost (25%)</th>
                  <th className="text-right pb-3">Subscription cost (£19.99 + 10%)</th>
                  <th className="text-right pb-3">You save</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {[
                  { sales: '£100', payg: '£25.00', sub: '£29.99', save: '-£4.99' },
                  { sales: '£200', payg: '£50.00', sub: '£39.99', save: '£10.01' },
                  { sales: '£500', payg: '£125.00', sub: '£69.99', save: '£55.01' },
                  { sales: '£1,000', payg: '£250.00', sub: '£119.99', save: '£130.01' },
                  { sales: '£5,000', payg: '£1,250.00', sub: '£519.99', save: '£730.01' },
                ].map((row) => (
                  <tr key={row.sales} className="border-b border-white/5">
                    <td className="py-3 font-medium">{row.sales}</td>
                    <td className="py-3 text-right text-red-400">{row.payg}</td>
                    <td className="py-3 text-right text-blue-400">{row.sub}</td>
                    <td className={`py-3 text-right font-semibold ${row.save.startsWith('-') ? 'text-gray-500' : 'text-green-400'}`}>
                      {row.save}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-xs mt-4">Break-even point: ~£199/month in sales. Above that, the subscription saves you money every month.</p>
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6">
        <h3 className="text-2xl font-bold text-white mb-8 text-center">Common questions</h3>
        <div className="space-y-6">
          {[
            {
              q: 'When do I get paid?',
              a: 'Payouts are processed every Friday. We manually transfer your earnings via bank transfer or PayPal — whichever you prefer.',
            },
            {
              q: 'Can I switch between plans?',
              a: 'Yes, anytime. If you upgrade to subscription mid-month, the lower commission rate applies immediately. If you downgrade, it takes effect from your next billing cycle.',
            },
            {
              q: 'What counts as a transaction?',
              a: 'Any skill acquisition on the platform — whether one-time purchase, per-use, or recurring access to your skill.',
            },
            {
              q: 'Do buyers pay anything extra?',
              a: 'No. Our commission is taken from the seller side. Buyers pay exactly the price listed — no hidden fees.',
            },
            {
              q: 'What payment methods do you support?',
              a: 'Card payments via Stripe, and USDC crypto (coming soon). More payment methods are on the roadmap.',
            },
          ].map((faq) => (
            <div key={faq.q} className="border-b border-white/10 pb-6">
              <h4 className="text-white font-semibold mb-2">{faq.q}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
