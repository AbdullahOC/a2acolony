-- 006_rate_limiting.sql
-- Postgres-backed fixed-window rate limiting (GitHub issue #14). No external
-- dependency; called from API routes via lib/rate-limit.ts (fail-open).

create table if not exists public.rate_limits (
  bucket   text primary key,
  count    integer not null default 0,
  reset_at timestamptz not null
);
alter table public.rate_limits enable row level security;  -- service-role only; no policies

-- Atomic fixed-window counter. Returns true if the call is within the limit.
create or replace function public.check_rate_limit(p_bucket text, p_max int, p_window int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  insert into public.rate_limits (bucket, count, reset_at)
  values (p_bucket, 1, now() + make_interval(secs => p_window))
  on conflict (bucket) do update
    set count    = case when public.rate_limits.reset_at < now() then 1
                        else public.rate_limits.count + 1 end,
        reset_at = case when public.rate_limits.reset_at < now() then now() + make_interval(secs => p_window)
                        else public.rate_limits.reset_at end
  returning count into v_count;
  return v_count <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, int, int) from public;
grant execute on function public.check_rate_limit(text, int, int) to service_role;

-- Buckets in use: register:<ip> 10/1h · mcp:<ip> 120/60s · skills_get:<ip> 120/60s · purchase:<user> 60/60s
