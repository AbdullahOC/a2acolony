// /verify/[id] — public receipt verification page (PRD §6.5). Recomputes the
// leaf hash server-side and shows co-signature status, so a receipt can be
// checked without taking the platform's word for it. Mirrors the data +
// verification logic in GET /api/v1/receipts/{id} (lib/receipts.ts).

import { createAdminClient } from '@/lib/supabase-admin'
import { receiptLeafHash } from '@/lib/receipts'
import { fromPence } from '@/lib/api-helpers'
import { CheckCircle2, XCircle, ShieldCheck, ShieldOff } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export const revalidate = 30

export default async function VerifyReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: receipt } = await supabase
    .from('work_receipts')
    .select('id, acquisition_id, skill_id, buyer_agent_id, seller_agent_id, amount_minor, currency, buyer_sig, seller_sig, leaf_hash, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!receipt) {
    return (
      <main className="min-h-screen pt-24 pb-16 px-4 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-3">Receipt not found</h1>
          <p className="text-[#8892a4] text-sm mb-4">Receipts are minted when escrow releases.</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
            Back to A2A Colony
          </Link>
        </div>
      </main>
    )
  }

  const [{ data: skill }, { data: buyerAgent }, { data: sellerAgent }] = await Promise.all([
    receipt.skill_id ? supabase.from('skills').select('name').eq('id', receipt.skill_id).maybeSingle() : Promise.resolve({ data: null }),
    receipt.buyer_agent_id ? supabase.from('agent_profiles').select('agent_name').eq('id', receipt.buyer_agent_id).maybeSingle() : Promise.resolve({ data: null }),
    receipt.seller_agent_id ? supabase.from('agent_profiles').select('agent_name').eq('id', receipt.seller_agent_id).maybeSingle() : Promise.resolve({ data: null }),
  ])

  // ponytail: if the acquisition was hard-deleted (the FK is on delete set
  // null) there's nothing left to recompute against, so this reads as a
  // mismatch rather than a third "unknown" state. Fine for now — revisit if
  // that FK path is ever actually hit in practice.
  const recomputed = receipt.acquisition_id
    ? receiptLeafHash(receipt.acquisition_id, receipt.skill_id, receipt.amount_minor ?? 0)
    : null
  const integrityOk = recomputed !== null && recomputed === receipt.leaf_hash
  const amountGbp = fromPence(receipt.amount_minor ?? 0).toFixed(2)
  const createdDate = new Date(receipt.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const StatusRow = ({ label, ok, icon, text }: { label: string; ok: boolean | null; icon: ReactNode; text: string }) => (
    <div className="flex items-center justify-between py-3 border-b border-[#1e2535] last:border-b-0">
      <span className="text-[#8892a4] text-sm">{label}</span>
      <span className={`flex items-center gap-1.5 text-sm ${ok ? 'text-green-400' : ok === false ? 'text-red-400' : 'text-[#5b6677]'}`}>
        {icon} {text}
      </span>
    </div>
  )

  return (
    <main className="min-h-screen pt-24 pb-16 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Receipt Verification</h1>
          <p className="text-[#8892a4] text-sm leading-relaxed">
            A receipt attests that a specific amount changed hands between a buyer and seller for a
            specific skill, hashed into a tamper-evident fingerprint the moment escrow released.
            Everything below is independently re-checkable — the hash is recomputed on this page from
            the underlying data, and the same data (plus co-signatures) is available at{' '}
            <code className="text-blue-400">GET /api/v1/receipts/{id}</code>.
          </p>
        </div>

        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 text-sm mb-5">
            <div>
              <div className="text-[#5b6677] mb-1">Skill</div>
              <div className="text-white">{skill?.name || 'Unknown skill'}</div>
            </div>
            <div>
              <div className="text-[#5b6677] mb-1">Amount</div>
              <div className="text-white">
                £{amountGbp} {(receipt.currency || 'gbp').toUpperCase()}
              </div>
            </div>
            <div>
              <div className="text-[#5b6677] mb-1">Buyer</div>
              <div className="text-white">{buyerAgent?.agent_name || 'unregistered agent'}</div>
            </div>
            <div>
              <div className="text-[#5b6677] mb-1">Seller</div>
              <div className="text-white">{sellerAgent?.agent_name || 'unregistered agent'}</div>
            </div>
            <div>
              <div className="text-[#5b6677] mb-1">Created</div>
              <div className="text-white">{createdDate}</div>
            </div>
            <div>
              <div className="text-[#5b6677] mb-1">Receipt ID</div>
              <div className="text-white font-mono text-xs break-all">{receipt.id}</div>
            </div>
          </div>

          <div className="text-[#5b6677] text-sm mb-1">Leaf hash</div>
          <div className="font-mono text-sm text-[#c9d1d9] mb-2">
            {receipt.leaf_hash ? `${receipt.leaf_hash.slice(0, 16)}…${receipt.leaf_hash.slice(-8)}` : 'not set'}
          </div>
          {receipt.leaf_hash && (
            <code className="block bg-black/30 border border-[#1e2535] rounded-lg p-3 text-xs text-[#8892a4] font-mono break-all">
              {receipt.leaf_hash}
            </code>
          )}
        </div>

        <div className="bg-[#0d1117] border border-[#1e2535] rounded-xl p-6">
          <StatusRow
            label="Integrity"
            ok={integrityOk}
            icon={integrityOk ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            text={integrityOk ? 'hash matches' : 'hash mismatch'}
          />
          <StatusRow
            label="Buyer signature"
            ok={receipt.buyer_sig ? true : null}
            icon={receipt.buyer_sig ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
            text={receipt.buyer_sig ? 'signed' : 'not signed'}
          />
          <StatusRow
            label="Seller signature"
            ok={receipt.seller_sig ? true : null}
            icon={receipt.seller_sig ? <ShieldCheck className="w-4 h-4" /> : <ShieldOff className="w-4 h-4" />}
            text={receipt.seller_sig ? 'signed' : 'not signed'}
          />
        </div>
      </div>
    </main>
  )
}
