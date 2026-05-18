-- Lifecycle fields needed to fix three correctness gaps:
--   1. Dunning retries were timed off last_payment_at, which conflates a
--      one-off failure with a months-stale subscription. last_failed_at gives
--      the cron a real anchor for the 3/7/14 day retry schedule.
--   2. cancel_at_period_end lets a user finish the cycle they paid for instead
--      of losing access immediately on cancel.
--   3. trial_reminders_sent is a monotonic counter the trial-expiry job uses to
--      avoid re-emailing the same tenant on every daily run (T-3, T-1).
ALTER TABLE "subscriptions"
  ADD COLUMN "last_failed_at" TIMESTAMP(3),
  ADD COLUMN "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trial_reminders_sent" INTEGER NOT NULL DEFAULT 0;

-- Backfill last_failed_at for currently-broken rows so dunning picks them up
-- on its next run with a sensible anchor (their last_payment_at, or now if
-- never paid). Without this, existing PAST_DUE subs would never retry under
-- the new logic until they fail again.
UPDATE "subscriptions"
   SET "last_failed_at" = COALESCE("last_payment_at", "updated_at", NOW())
 WHERE "failed_attempts" > 0
   AND "last_failed_at" IS NULL;
