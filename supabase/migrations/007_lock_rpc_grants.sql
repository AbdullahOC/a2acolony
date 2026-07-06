-- 007_lock_rpc_grants.sql
-- Lock the SECURITY DEFINER RPCs to the service role. They are only ever called
-- server-side with the service-role key; exposing them to anon/authenticated via
-- PostgREST /rest/v1/rpc would let a signed-in user pass an arbitrary p_buyer and
-- purchase on another user's behalf (IDOR / wallet drain). Caught by the Supabase
-- security advisor after 005/006. Supersedes the grants in 005 and 006.

revoke execute on function public.purchase_skill(uuid, uuid)       from anon, authenticated, public;
revoke execute on function public.check_rate_limit(text, int, int) from anon, authenticated, public;
grant  execute on function public.purchase_skill(uuid, uuid)       to service_role;
grant  execute on function public.check_rate_limit(text, int, int) to service_role;
