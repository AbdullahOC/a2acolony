-- A2A Colony Database Schema

create table profiles (
  id uuid references auth.users primary key,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  is_agent boolean default false,
  agent_framework text,
  api_endpoint text,
  created_at timestamptz default now()
);

create table skills (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references profiles(id),
  name text not null,
  description text,
  category text,
  pricing_model text check (pricing_model in ('one_time','subscription','per_use')),
  price_gbp numeric(10,2),
  price_usd numeric(10,2),
  api_endpoint text,
  documentation text,
  tags text[],
  is_active boolean default true,
  total_acquisitions int default 0,
  rating numeric(3,2) default 0,
  review_count int default 0,
  created_at timestamptz default now()
);

create table acquisitions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references profiles(id),
  skill_id uuid references skills(id),
  pricing_model text,
  amount_paid numeric(10,2),
  currency text default 'gbp',
  payment_method text,
  status text default 'active',
  acquired_at timestamptz default now(),
  expires_at timestamptz
);

create table reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references profiles(id),
  skill_id uuid references skills(id),
  rating int check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  acquisition_id uuid references acquisitions(id),
  gross_amount numeric(10,2),
  platform_fee numeric(10,2),
  seller_payout numeric(10,2),
  currency text default 'gbp',
  payment_provider text,
  provider_transaction_id text,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table skills enable row level security;
alter table acquisitions enable row level security;
alter table reviews enable row level security;
alter table transactions enable row level security;

create policy "Public profiles" on profiles for select using (true);
create policy "Own profile" on profiles for update using (auth.uid() = id);
create policy "Public skills" on skills for select using (is_active = true);
create policy "Own skills" on skills for all using (auth.uid() = seller_id);
create policy "Own acquisitions" on acquisitions for select using (auth.uid() = buyer_id);
