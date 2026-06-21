'use client'

import { useState } from 'react'
import { CATEGORIES } from '@/lib/placeholder-data'
import {
  setSkillActive,
  deleteSkill,
  updateSkill,
  setProfileFlag,
  updateProfile,
  deleteProfile,
  refundTransaction,
  recordCompanyCashout,
  setSetting,
  approveJobReview,
  bounceJobReview,
} from './actions'

/* ---------------- shared ---------------- */

const inputCls =
  'w-full rounded-lg border border-[#1e2535] bg-[#07090f] px-3 py-2 text-sm text-white outline-none focus:border-blue-500'
const labelCls = 'mb-1 block text-xs font-medium text-[#8892a4]'

function useRunner() {
  const [busy, setBusy] = useState(false)
  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    try {
      const r = (await fn()) as { ok?: boolean; error?: string } | void
      if (r && r.ok === false) {
        alert(r.error || 'Action failed.')
        return false
      }
      return true
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed.')
      return false
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-[#1e2535] bg-[#0d1117] p-5 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-[#8892a4] hover:text-white" aria-label="Close">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Human-verification gate: operator must type the exact phrase to arm the action. */
function VerifyGate({ phrase, children }: { phrase: string; children: (armed: boolean) => React.ReactNode }) {
  const [typed, setTyped] = useState('')
  const armed = typed.trim().toUpperCase() === phrase.toUpperCase()
  return (
    <div className="space-y-2">
      <label className={labelCls}>
        Human verification — type <span className="font-mono text-yellow-300">{phrase}</span> to proceed
      </label>
      <input className={inputCls} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={phrase} autoFocus />
      {children(armed)}
    </div>
  )
}

/* ---------------- Skills ---------------- */

export function SkillRowActions({
  id,
  name,
  category,
  price,
  active,
}: {
  id: string
  name: string
  category: string
  price: number
  active: boolean
}) {
  const { busy, run } = useRunner()
  const [editing, setEditing] = useState(false)
  const [n, setN] = useState(name)
  const [c, setC] = useState(category)
  const [p, setP] = useState(String(price))
  const known = CATEGORIES as { id: string; label: string }[]

  return (
    <div className="flex justify-end gap-2">
      <button onClick={() => setEditing(true)} className="rounded border border-[#1e2535] px-2 py-1 text-xs text-[#8892a4] hover:text-white">
        Edit
      </button>
      <button
        disabled={busy}
        onClick={() => run(() => setSkillActive(id, !active))}
        className="rounded border border-[#1e2535] px-2 py-1 text-xs text-[#8892a4] hover:text-white disabled:opacity-50"
      >
        {active ? 'Hide' : 'Show'}
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (confirm('Delete this skill permanently?')) run(() => deleteSkill(id))
        }}
        className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-50"
      >
        Delete
      </button>

      {editing && (
        <Modal title="Edit skill" onClose={() => setEditing(false)}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Name</label>
              <input className={inputCls} value={n} onChange={(e) => setN(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <select className={inputCls} value={c} onChange={(e) => setC(e.target.value)}>
                {!known.some((x) => x.id === c) && <option value={c}>{c || '—'}</option>}
                {known.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Price (GBP)</label>
              <input className={inputCls} type="number" step="0.01" min="0" value={p} onChange={(e) => setP(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-[#1e2535] px-3 py-1.5 text-sm text-[#8892a4]">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (await run(() => updateSkill(id, { name: n, category: c, price: parseFloat(p) }))) setEditing(false)
                }}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Members ---------------- */

export function MemberRowActions({
  id,
  name,
  isAgent,
  suspended,
  verified,
  migrated,
}: {
  id: string
  name: string
  isAgent: boolean
  suspended: boolean
  verified: boolean
  migrated: boolean
}) {
  const { busy, run } = useRunner()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [n, setN] = useState(name)
  const [agent, setAgent] = useState(isAgent)

  return (
    <div className="flex flex-wrap justify-end gap-2">
      <button onClick={() => setEditing(true)} className="rounded border border-[#1e2535] px-2 py-1 text-xs text-[#8892a4] hover:text-white">
        Edit
      </button>
      {migrated && (
        <>
          <button
            disabled={busy}
            onClick={() => run(() => setProfileFlag(id, 'is_verified', !verified))}
            className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${verified ? 'border-blue-500/40 text-blue-300' : 'border-[#1e2535] text-[#8892a4] hover:text-white'}`}
          >
            {verified ? 'Verified ✓' : 'Verify'}
          </button>
          <button
            disabled={busy}
            onClick={() => run(() => setProfileFlag(id, 'is_suspended', !suspended))}
            className={`rounded border px-2 py-1 text-xs disabled:opacity-50 ${suspended ? 'border-red-500/40 text-red-300' : 'border-[#1e2535] text-[#8892a4] hover:text-white'}`}
          >
            {suspended ? 'Suspended' : 'Suspend'}
          </button>
        </>
      )}
      <button onClick={() => setConfirming(true)} className="rounded border border-red-500/30 px-2 py-1 text-xs text-red-400 hover:bg-red-500/10">
        Delete
      </button>

      {editing && (
        <Modal title="Edit member" onClose={() => setEditing(false)}>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Display name</label>
              <input className={inputCls} value={n} onChange={(e) => setN(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={agent ? 'agent' : 'member'} onChange={(e) => setAgent(e.target.value === 'agent')}>
                <option value="member">Member</option>
                <option value="agent">Agent</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setEditing(false)} className="rounded-lg border border-[#1e2535] px-3 py-1.5 text-sm text-[#8892a4]">
                Cancel
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  if (await run(() => updateProfile(id, { name: n, isAgent: agent }))) setEditing(false)
                }}
                className="rounded-lg bg-blue-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {confirming && (
        <Modal title="Delete member" onClose={() => setConfirming(false)}>
          <p className="mb-3 text-xs text-[#8892a4]">
            Permanently deletes <span className="text-white">{name}</span>. Members with listings or transactions
            can&apos;t be deleted until those are removed.
          </p>
          <VerifyGate phrase="DELETE">
            {(armed) => (
              <button
                disabled={busy || !armed}
                onClick={async () => {
                  if (await run(() => deleteProfile(id))) setConfirming(false)
                }}
                className="mt-3 w-full rounded-lg bg-red-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                Delete member
              </button>
            )}
          </VerifyGate>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Transactions ---------------- */

export function TransactionRowActions({ id, status }: { id: string; status: string }) {
  const { busy, run } = useRunner()
  const [open, setOpen] = useState(false)
  if (status === 'refunded') return <span className="text-xs text-[#5b6677]">refunded</span>

  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded border border-yellow-500/30 px-2 py-1 text-xs text-yellow-300 hover:bg-yellow-500/10">
        Cancel / Refund
      </button>
      {open && (
        <Modal title="Cancel / refund transaction" onClose={() => setOpen(false)}>
          <p className="mb-3 text-xs text-[#8892a4]">
            Marks transaction <span className="font-mono">{id.slice(0, 8)}</span> as refunded. No money moves
            automatically — process the actual refund through your payment provider.
          </p>
          <VerifyGate phrase="REFUND">
            {(armed) => (
              <button
                disabled={busy || !armed}
                onClick={async () => {
                  if (await run(() => refundTransaction(id))) setOpen(false)
                }}
                className="mt-3 w-full rounded-lg bg-red-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-40"
              >
                Confirm refund
              </button>
            )}
          </VerifyGate>
        </Modal>
      )}
    </>
  )
}

export function CashoutForm({ availableGbp, tableReady }: { availableGbp: number; tableReady: boolean }) {
  const { busy, run } = useRunner()
  const [open, setOpen] = useState(false)
  const [amt, setAmt] = useState('')
  const [ref, setRef] = useState('')

  return (
    <div className="rounded-xl border border-[#1e2535] bg-[#0d1117] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold text-white">Company funds</div>
          <div className="text-xs text-[#8892a4]">Accrued platform fees available to withdraw</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">£{availableGbp.toFixed(2)}</div>
          <button onClick={() => setOpen(true)} className="mt-1 rounded-lg bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-600">
            Cash out…
          </button>
        </div>
      </div>
      {!tableReady && (
        <p className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-300">
          Run migration <code>003</code> to enable recording company cash-outs.
        </p>
      )}
      {open && (
        <Modal title="Record company cash-out" onClose={() => setOpen(false)}>
          <p className="mb-3 text-xs text-[#8892a4]">
            Records a withdrawal of platform funds for your books. The actual bank transfer is performed by you
            out-of-band — nothing is moved automatically.
          </p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Amount (GBP)</label>
              <input className={inputCls} type="number" step="0.01" min="0" value={amt} onChange={(e) => setAmt(e.target.value)} placeholder={availableGbp.toFixed(2)} />
            </div>
            <div>
              <label className={labelCls}>Reference / note</label>
              <input className={inputCls} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="bank ref, period…" />
            </div>
            <VerifyGate phrase="CASH OUT">
              {(armed) => (
                <button
                  disabled={busy || !armed}
                  onClick={async () => {
                    if (await run(() => recordCompanyCashout(parseFloat(amt), ref))) {
                      setOpen(false)
                      setAmt('')
                      setRef('')
                    }
                  }}
                  className="w-full rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-40"
                >
                  Confirm cash-out
                </button>
              )}
            </VerifyGate>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ---------------- Settings ---------------- */

export function SettingToggle({
  settingKey,
  label,
  desc,
  value,
}: {
  settingKey: string
  label: string
  desc: string
  value: boolean
}) {
  const { busy, run } = useRunner()
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#1e2535] bg-[#0d1117] p-4">
      <div>
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="text-xs text-[#8892a4]">{desc}</div>
      </div>
      <button
        disabled={busy}
        aria-pressed={value}
        onClick={() => run(() => setSetting(settingKey, !value))}
        className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${value ? 'bg-blue-500' : 'bg-[#1e2535]'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${value ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

/* ---------------- Jobs ---------------- */

export function JobReviewActions({ jobId, status }: { jobId: string; status: string }) {
  const { busy, run } = useRunner()
  if (status !== 'needs_human_review') return <span className="text-xs text-[#5b6677]">—</span>
  return (
    <div className="flex justify-end gap-2">
      <button
        disabled={busy}
        onClick={() => {
          if (confirm('Approve this work and notify the client?')) run(() => approveJobReview(jobId))
        }}
        className="rounded border border-green-500/30 px-2 py-1 text-xs text-green-400 hover:bg-green-500/10 disabled:opacity-50"
      >
        Approve
      </button>
      <button
        disabled={busy}
        onClick={() => {
          if (confirm('Send back to the agent for another revision round?')) run(() => bounceJobReview(jobId))
        }}
        className="rounded border border-[#1e2535] px-2 py-1 text-xs text-[#8892a4] hover:text-white disabled:opacity-50"
      >
        Send back
      </button>
    </div>
  )
}
