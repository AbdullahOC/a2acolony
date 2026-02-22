-- Migration 001: Seller payment tracking
-- Adds subscription management, commission tracking, and payout ledger
-- Run date: 2026-02-22

-- ============================================================
-- 1. PROFILES — add subscription + payout fields
-- ============================================================

alter table profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'subscribed')),
  add column if not exists commission_rate numeric(5,2) not null default 25.00,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists subscription_status text
    check (subscription_status in ('active', 'cancelled', 'past_due', 'trialing')),
  add column if not exists subscription_started_at timestamptz,
  add column if not exists subscription_ends_at timestamptz,
  add column if not exists payout_method text
    check (payout_method in ('bank_transfer', 'paypal', 'wise')),
  add column if not exists payout_email text,      -- PayPal / Wise email
  add column if not exists payout_bank_name text,
  add column if not exists payout_account_name text,
  add column if not exists payout_sort_code text,
  add column if not exists payout_account_number text,
  add column if not exists total_earned numeric(10,2) not null default 0.00,
  add column if not exists total_paid_out numeric(10,2) not null default 0.00,
  add column if not exists total_pending numeric(10,2) not null default 0.00;

comment on column profiles.commission_rate is 'Current commission % taken by platform (25 = PAYG, 10 = subscribed)';
comment on column profiles.total_earned is 'Cumulative seller earnings (after platform fee), all time';
comment on column profiles.total_paid_out is 'Cumulative amount actually transferred to seller';
comment on column profiles.total_pending is 'Earnings awaiting next payout run';

-- ============================================================
-- 2. TRANSACTIONS — add seller ref, commission rate, payout status
-- ============================================================

alter table transactions
  add column if not exists seller_id uuid references profiles(id),
  add column if not exists skill_id uuid references skills(id),
  add column if not exists commission_rate numeric(5,2),   -- rate applied at time of sale
  add column if not exists stripe_payment_intent_id text,
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'paid_out', 'refunded', 'disputed')),
  add column if not exists payout_id uuid;               -- filled when included in a payout

comment on column transactions.commission_rate is 'Platform commission % applied to this transaction';
comment on column transactions.status is 'pending = awaiting payout; paid_out = included in a payout batch';

-- ============================================================
-- 3. PAYOUTS — the ledger of actual transfers to sellers
-- ============================================================

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references profiles(id),

  -- Amounts
  gross_amount numeric(10,2) not null,          -- sum of all seller_payout from transactions
  currency text not null default 'gbp',

  -- Payout method snapshot (in case seller changes details later)
  payout_method text,
  payout_reference text,                        -- bank ref, PayPal tx ID, Wise ID etc.
  payout_email text,
  payout_bank_name text,
  payout_account_name text,
  payout_sort_code text,
  payout_account_number text,

  -- Period
  period_start date not null,                   -- start of earnings window (inclusive)
  period_end date not null,                     -- end of earnings window (inclusive)
  transaction_count int not null default 0,

  -- Status
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'paid', 'failed', 'cancelled')),
  processed_by text,                            -- 'manual:bilal' or later 'stripe_connect'
  processed_at timestamptz,
  failed_reason text,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table payouts is 'Each row = one payout batch sent to one seller. Immutable audit log.';

-- FK from transactions back to payouts
alter table transactions
  add constraint fk_transactions_payout
    foreign key (payout_id) references payouts(id);

-- ============================================================
-- 4. FUNCTION — mark a payout as paid and update balances
-- ============================================================

create or replace function mark_payout_paid(
  p_payout_id uuid,
  p_reference text,
  p_processed_by text default 'manual:bilal'
)
returns void language plpgsql security definer as $$
declare
  v_seller_id uuid;
  v_amount numeric(10,2);
begin
  -- Fetch payout details
  select seller_id, gross_amount
    into v_seller_id, v_amount
    from payouts
   where id = p_payout_id and status = 'pending';

  if not found then
    raise exception 'Payout % not found or not pending', p_payout_id;
  end if;

  -- Mark payout as paid
  update payouts set
    status = 'paid',
    payout_reference = p_reference,
    processed_by = p_processed_by,
    processed_at = now(),
    updated_at = now()
  where id = p_payout_id;

  -- Mark all transactions in this payout as paid_out
  update transactions set status = 'paid_out'
  where payout_id = p_payout_id;

  -- Update seller running totals
  update profiles set
    total_paid_out = total_paid_out + v_amount,
    total_pending = greatest(0, total_pending - v_amount)
  where id = v_seller_id;
end;
$$;

-- ============================================================
-- 5. FUNCTION — auto-update commission_rate when subscription changes
-- ============================================================

create or replace function sync_commission_rate()
returns trigger language plpgsql as $$
begin
  if new.subscription_tier = 'subscribed' and new.subscription_status = 'active' then
    new.commission_rate := 10.00;
  else
    new.commission_rate := 25.00;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_commission on profiles;
create trigger trg_sync_commission
  before update of subscription_tier, subscription_status on profiles
  for each row execute function sync_commission_rate();

-- ============================================================
-- 6. RLS — payouts visible to the seller, full access for service role
-- ============================================================

alter table payouts enable row level security;

create policy "Seller sees own payouts"
  on payouts for select
  using (auth.uid() = seller_id);

-- Transactions: seller can see their own
create policy "Seller sees own transactions"
  on transactions for select
  using (auth.uid() = seller_id);

-- ============================================================
-- 7. INDEXES for reporting queries
-- ============================================================

create index if not exists idx_transactions_seller_status
  on transactions(seller_id, status);

create index if not exists idx_transactions_payout_id
  on transactions(payout_id);

create index if not exists idx_payouts_seller_status
  on payouts(seller_id, status);
