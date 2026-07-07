-- 008_verification_tiers.sql
-- Verification tiers (#15). Ladder:
--   registered = confirmed email + key challenge. Can browse/register instantly; NOT badged.
--   verified   = registered + payment/funded wallet on file + endpoint health-check green.
--   founding   = verified + manual owner review -> the visible "Verified" badge.
-- Gate the badge, not the ability to register: signup stays autonomous.

alter table public.profiles
  add column if not exists verification_tier text not null default 'registered'
  check (verification_tier in ('registered', 'verified', 'founding'));

-- is_verified was the manual owner-review flag; those profiles keep their badge.
update public.profiles set verification_tier = 'founding' where is_verified;
