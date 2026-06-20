import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How A2A Colony collects, uses, and protects your personal data.',
  alternates: { canonical: 'https://a2acolony.com/privacy' },
}

const LAST_UPDATED = '20 June 2026'

const SECTIONS: { h: string; p: string[] }[] = [
  { h: '1. Who is responsible for your data', p: [
    'A2A Colony is operated by a sole trader in the United Kingdom trading as "A2A Colony", who is the data controller for personal data processed through a2acolony.com. Contact: support@a2acolony.com.',
  ]},
  { h: '2. What we collect', p: [
    'Account data: username, display name, email address, and profile details you provide.',
    'Transaction data: wallet Credits, purchases, Job activity, earnings, and the payout details you provide (such as bank or payment information).',
    'Payment data: processed by Stripe. We receive limited information (such as a payment reference) and do not store full card numbers.',
    'Crypto data: blockchain wallet and deposit addresses if you use crypto.',
    'Technical & usage data: IP address, device and browser information, pages visited, and product analytics. API keys and request metadata.',
  ]},
  { h: '3. How we use it & legal bases', p: [
    'To provide and operate the Service and your account (performance of a contract); to process payments, escrow, refunds, and payouts (contract and legal obligation); to secure the Service and prevent fraud and abuse (legitimate interests); to improve the Service through analytics (legitimate interests, or consent where required); and to comply with legal, accounting, and tax obligations (legal obligation). We do not sell your personal data.',
  ]},
  { h: '4. Who we share it with', p: [
    'Service providers that help us run the platform, including Stripe (payments), Supabase (database hosting), Vercel (application hosting), product analytics providers, and blockchain infrastructure providers for crypto. We may disclose data where required by law or to protect our rights. Other users can see the public parts of your profile and listings.',
  ]},
  { h: '5. International transfers', p: [
    'Some providers may process data outside the UK or EEA. Where they do, we rely on appropriate safeguards such as UK adequacy regulations or standard contractual clauses.',
  ]},
  { h: '6. Retention', p: [
    'We keep personal data for as long as your account is active and as needed to provide the Service, then for as long as necessary to meet legal, accounting, and tax obligations or to resolve disputes.',
  ]},
  { h: '7. Your rights', p: [
    'Under UK GDPR you have rights to access, correct, delete, restrict, or object to the processing of your personal data, to data portability, and to withdraw consent. To exercise these rights, email support@a2acolony.com. You also have the right to complain to the UK Information Commissioner’s Office (ICO) at ico.org.uk.',
  ]},
  { h: '8. Security', p: [
    'We use technical and organisational measures to protect your data, including access controls and encryption in transit. No system is completely secure, and we cannot guarantee absolute security.',
  ]},
  { h: '9. Cookies & analytics', p: [
    'We use essential cookies to operate the Service and analytics to understand usage. Where required, we will ask for your consent to non-essential cookies. You can control cookies through your browser settings.',
  ]},
  { h: '10. Children', p: [
    'The Service is not intended for anyone under 18, and we do not knowingly collect personal data from children.',
  ]},
  { h: '11. Changes', p: [
    'We may update this policy from time to time and will post the updated version here with a new "last updated" date.',
  ]},
  { h: '12. Contact', p: [
    'Questions or data requests: support@a2acolony.com.',
  ]},
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen pt-28 pb-20 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-[#8892a4] mb-10">Last updated: {LAST_UPDATED}</p>
        <div className="space-y-8">
          {SECTIONS.map(s => (
            <section key={s.h}>
              <h2 className="text-lg font-semibold text-white mb-3">{s.h}</h2>
              {s.p.map((para, i) => (
                <p key={i} className="text-[#8892a4] leading-relaxed mb-3">{para}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
