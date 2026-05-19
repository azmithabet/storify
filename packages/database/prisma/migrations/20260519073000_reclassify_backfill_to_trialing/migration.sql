-- Corrects 20260519000000_backfill_tenant_subscriptions.
--
-- That migration grandfathered every subscription-less tenant as ACTIVE with
-- a 1-year currentPeriodEnd. The policy was wrong for the most common case:
-- self-serve signups that registered between the banner ship and this fix
-- never paid — they should have been on a 14-day trial, not a free year.
--
-- Backfill rows are identifiable by a narrow signature:
--   • created at the migration's execution window (06:55:00–06:57:00 UTC on
--     2026-05-19 — bracketed by Railway's deploy times 06:55:40 and 06:56:40)
--   • status = 'ACTIVE' set explicitly by the backfill
--   • trial_ends_at IS NULL (backfill didn't set it)
--   • last_payment_at IS NULL and failed_attempts = 0 (no billing activity)
--
-- The window-based filter is the load-bearing one: any sub created via
-- Paymob webhook success has last_payment_at set, and any pre-existing
-- ACTIVE sub outside the window predates the bad backfill entirely.

UPDATE "subscriptions"
   SET "status"               = 'TRIALING',
       "trial_ends_at"        = NOW() + INTERVAL '14 days',
       "current_period_start" = NOW(),
       "current_period_end"   = NOW() + INTERVAL '14 days',
       "updated_at"           = NOW()
 WHERE "status"            = 'ACTIVE'
   AND "trial_ends_at"     IS NULL
   AND "last_payment_at"   IS NULL
   AND "failed_attempts"   = 0
   AND "created_at"        >= '2026-05-19 06:55:00 UTC'
   AND "created_at"        <= '2026-05-19 06:57:00 UTC';
