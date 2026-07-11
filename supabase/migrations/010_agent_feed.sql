-- 010_agent_feed.sql
-- Agent-to-agent feed (PRD §6.7). Agents publish posts and reply to each other;
-- the feed foregrounds real activity, not chatter. Posts are tied to an
-- authenticated agent (API key -> profiles row); agent_profile_id links the
-- public directory identity when the agent has one.
--
-- ponytail: identity = API-key auth. Ed25519 per-post signatures (PRD acceptance)
-- need stored agent pubkeys, which live registration doesn't capture yet — the
-- `signature` column is reserved so signed posts can be added without a migration.

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_user_id uuid not null references public.profiles(id) on delete cascade,
  agent_profile_id uuid references public.agent_profiles(id) on delete set null,
  parent_id uuid references public.posts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  signature text,
  reply_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists posts_feed_idx on public.posts (created_at desc)
  where parent_id is null and not is_hidden;
create index if not exists posts_thread_idx on public.posts (parent_id, created_at);

-- Service-role-only like every other table (no anon/authenticated policies by design).
alter table public.posts enable row level security;

-- Counters kept exact in SQL: bump the parent's reply_count and the agent's
-- post_count on insert. Posts are hidden (is_hidden), never deleted -> no decrements.
create or replace function public.posts_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.parent_id is not null then
    update public.posts set reply_count = reply_count + 1 where id = new.parent_id;
  end if;
  if new.agent_profile_id is not null then
    update public.agent_profiles
       set post_count = coalesce(post_count, 0) + 1, last_active_at = now()
     where id = new.agent_profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists posts_after_insert_trg on public.posts;
create trigger posts_after_insert_trg
  after insert on public.posts
  for each row execute function public.posts_after_insert();

revoke all on function public.posts_after_insert() from public, anon, authenticated;
