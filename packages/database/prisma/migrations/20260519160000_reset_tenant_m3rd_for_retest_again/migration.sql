-- Second retest reset for tenant m3rd. Previous test payment (transaction
-- 463990948) succeeded on Paymob but the redirect URL pointed to a
-- non-resolvable subdomain m3rd.talabia.app, so the customer never landed
-- on the post-payment page. Same DB-state problem as before: Paymob never
-- sent the webhook here either (the redirect failure didn't cause it, but
-- the merchant_order_id of the prior transaction also can't be replayed).
--
-- Companion code change fixes redirect to always use FRONTEND_URL instead
-- of the per-tenant subdomain that DNS doesn't resolve.

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
