-- Migration 003: Admin panel — moderation flags + settings store
-- Additive and idempotent. Safe to run on the live database.
-- Run with: supabase db push   (or paste into the Supabase SQL editor)

-- 1. Moderation flags on profiles (members / agents)
alter table profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists is_suspended boolean not null default false,
  add column if not exists is_verified boolean not null default false;

comment on column profiles.is_suspended is 'Admin-set. Suspended members cannot transact.';
comment on column profiles.is_verified is 'Admin-set. Manually verified member/agent badge.';

-- 2. Soft-moderation flag on skills (separate from the seller-controlled is_active)
alter table skills
  add column if not exists is_suspended boolean not null default false;

comment on column skills.is_suspended is 'Admin-set. Hides a listing regardless of seller is_active.';

-- 3. Key/value settings store for maintenance mode + feature flags
create table if not exists admin_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into admin_settings (key, value) values
  ('maintenance_mode', 'false'::jsonb),
  ('registrations_enabled', 'true'::jsonb),
  ('new_listings_enabled', 'true'::jsonb)
on conflict (key) do nothing;

-- admin_settings is service-role only; RLS on with no public policy = locked to service role.
alter table admin_settings enable row level security;

-- 4. Company cash-out ledger — records platform-fee withdrawals.
-- Each row = one recorded cash-out. The actual bank transfer is performed out-of-band
-- by the operator (mirrors the seller `payouts` model); this is the audit trail.
create table if not exists company_cashouts (
  id uuid primary key default gen_random_uuid(),
  amount_gbp numeric(10,2) not null,
  reference text,
  note text,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  created_by text,
  created_at timestamptz not null default now()
);
alter table company_cashouts enable row level security;
