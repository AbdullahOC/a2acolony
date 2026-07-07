'use server'

import { revalidatePath } from 'next/cache'
import { isAdminAuthed } from '@/lib/admin-session'
import { createAdminClient } from '@/lib/supabase-admin'

async function guard() {
  if (!(await isAdminAuthed())) throw new Error('Unauthorized')
  return createAdminClient()
}

export async function setSkillActive(id: string, active: boolean) {
  const s = await guard()
  const { error } = await s.from('skills').update({ is_active: active }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/skills')
}

export async function deleteSkill(id: string) {
  const s = await guard()
  const { error } = await s.from('skills').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/skills')
}

export async function setProfileFlag(
  id: string,
  field: 'is_suspended' | 'is_verified',
  value: boolean,
) {
  const s = await guard()
  const patch: Record<string, unknown> = { [field]: value }
  // Owner review drives the 'founding' tier (#15). Un-badging drops to 'registered';
  // ponytail: the agent can self re-earn 'verified' via POST /api/v1/agents/verify.
  if (field === 'is_verified') patch.verification_tier = value ? 'founding' : 'registered'
  const { error } = await s.from('profiles').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/agents')
}

export async function setSetting(key: string, value: boolean) {
  const s = await guard()
  const { error } = await s
    .from('admin_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(error.message)
  revalidatePath('/admin/settings')
  revalidatePath('/', 'layout')
}

type Result = { ok: true } | { ok: false; error: string }

// ---- Skills: edit name / category / price ----
export async function updateSkill(
  id: string,
  patch: { name?: string; category?: string; price?: number },
): Promise<Result> {
  const s = await guard()
  const upd: Record<string, unknown> = {}
  if (patch.name != null && patch.name.trim()) upd.name = patch.name.trim()
  if (patch.category != null && patch.category.trim()) upd.category = patch.category.trim()
  if (patch.price != null && Number.isFinite(patch.price)) upd.price_gbp = Math.max(0, Math.round(patch.price * 100) / 100)
  if (Object.keys(upd).length === 0) return { ok: false, error: 'Nothing to update.' }
  const { error } = await s.from('skills').update(upd).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/skills')
  return { ok: true }
}

// ---- Members: edit name / type, delete ----
export async function updateProfile(
  id: string,
  patch: { name?: string; isAgent?: boolean },
): Promise<Result> {
  const s = await guard()
  const upd: Record<string, unknown> = {}
  if (patch.name != null && patch.name.trim()) upd.display_name = patch.name.trim()
  if (patch.isAgent != null) upd.is_agent = patch.isAgent
  if (Object.keys(upd).length === 0) return { ok: false, error: 'Nothing to update.' }
  const { error } = await s.from('profiles').update(upd).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/agents')
  return { ok: true }
}

export async function deleteProfile(id: string): Promise<Result> {
  const s = await guard()
  const { error } = await s.from('profiles').delete().eq('id', id)
  if (error) {
    const fk = error.code === '23503' || /foreign key/i.test(error.message)
    return { ok: false, error: fk ? 'This member still has skills or transactions — remove those first.' : error.message }
  }
  revalidatePath('/admin/agents')
  return { ok: true }
}

// ---- Transactions: cancel / refund (DB state only; money handled out-of-band) ----
export async function refundTransaction(id: string): Promise<Result> {
  const s = await guard()
  const { error } = await s.from('transactions').update({ status: 'refunded' }).eq('id', id)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/transactions')
  return { ok: true }
}

// ---- Company cash-out: RECORD a withdrawal of platform funds (no money is moved here) ----
export async function recordCompanyCashout(amountGbp: number, reference: string): Promise<Result> {
  const s = await guard()
  if (!Number.isFinite(amountGbp) || amountGbp <= 0) return { ok: false, error: 'Enter a valid amount.' }
  const { error } = await s.from('company_cashouts').insert({
    amount_gbp: Math.round(amountGbp * 100) / 100,
    reference: reference?.trim() || null,
    status: 'pending',
    created_by: 'admin',
  })
  if (error) {
    const missing = error.code === '42P01' || /company_cashouts/.test(error.message)
    return { ok: false, error: missing ? 'Run migration 003 to enable company cash-outs.' : error.message }
  }
  revalidatePath('/admin/transactions')
  return { ok: true }
}

// ---- Jobs: resolve a quality-gate escalation (needs_human_review) ----
export async function approveJobReview(jobId: string): Promise<Result> {
  const s = await guard()
  const { error } = await s
    .from('jobs')
    .update({ review_status: 'passed', status: 'delivered', updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/jobs')
  return { ok: true }
}

export async function bounceJobReview(jobId: string): Promise<Result> {
  const s = await guard()
  const { error } = await s
    .from('jobs')
    .update({ review_status: 'revision_requested', review_attempts: 0, updated_at: new Date().toISOString() })
    .eq('id', jobId)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/jobs')
  return { ok: true }
}
