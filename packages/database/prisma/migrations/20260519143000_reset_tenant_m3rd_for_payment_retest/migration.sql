-- One-off operational fix: tenant `m3rd` (cmpa8sosj0001zgwu9lyrus2b) ran a
-- test card payment through Paymob which succeeded on Paymob's side, but the
-- Paymob → /billing/paymob/webhook callback URL wasn't configured at that
-- point so our DB never saw the transaction. The companion code change in
-- this commit sets redirect_url + notification_url per-transaction on the
-- payment_keys call so future checkouts route correctly.
--
-- This migration resets that tenant's subscription to a fresh 14-day TRIALING
-- so the end-to-end flow can be retested cleanly:
--   • drops any payment_attempts rows that referenced the stale subscription
--   • zeroes failure counters / payment timestamps / card token / cancel flag
--   • restarts the trial clock from NOW()
--
-- Tenant ID is hardcoded because this is a single-tenant cleanup, not a
-- general policy change. Idempotent: re-running just resets the clock again,
-- which is fine pre-go-live but harmless to leave in history.

DELETE FROM "payment_attempts"
 WHERE "subscription_id" IN (
   SELECT "id" FROM "subscriptions" WHERE "tenant_id" = 'cmpa8sosj0001zgwu9lyrus2b'
 );

UPDATE "subscriptions"
   SET "status"                = 'TRIALING',
       "trial_ends_at"         = NOW() + INTERVAL '14 days',
       "current_period_start"  = NOW(),
       "current_period_end"    = NOW() + INTERVAL '14 days',
       "cancel_at_period_end"  = false,
       "last_payment_at"       = NULL,
       "last_failed_at"        = NULL,
       "last_failure_reason"   = NULL,
       "failed_attempts"       = 0,
       "trial_reminders_sent"  = 0,
       "provider_card_token"   = NULL,
       "next_billing_at"       = NULL,
       "updated_at"            = NOW()
 WHERE "tenant_id" = 'cmpa8sosj0001zgwu9lyrus2b';
