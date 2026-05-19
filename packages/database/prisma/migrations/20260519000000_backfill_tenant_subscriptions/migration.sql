-- One-shot backfill: every existing ACTIVE tenant predates the provisionTenant
-- → startTrial() wiring, so none of them have a Subscription row. The in-app
-- billing banner reads /billing/status, which returns null for these tenants
-- and renders nothing.
--
-- Policy: grandfather them as ACTIVE with a 1-year currentPeriodEnd rather
-- than starting a 14-day trial clock. Putting live customers into TRIALING
-- would silently arm the trial-expiry job to email them at T-3/T-1 and flip
-- them to PAST_DUE → SUSPENDED → CANCELLED within ~30 days — a billing
-- enforcement change disguised as a data fix. ACTIVE + far-future period end
-- keeps the system inert for existing tenants while still giving the banner
-- (and any other code that JOINs to subscriptions) a row to read.
--
-- New signups going forward get a real TRIALING subscription via the
-- provisionTenant() change landing in the same deploy.
--
-- Tenants in PROVISIONING / SUSPENDED / CANCELLED are skipped: provisioning
-- means signup didn't complete, the other two are not live customers.
--
-- Id uses gen_random_uuid()::text because subscriptions.id is a plain TEXT
-- column (Prisma's @default(cuid()) is app-side). The format mix is purely
-- cosmetic — uniqueness and FK joins are unaffected.

INSERT INTO "subscriptions" (
  "id",
  "tenant_id",
  "plan_id",
  "billing_cycle",
  "status",
  "current_period_start",
  "current_period_end",
  "price_at_subscription",
  "provider",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t.id,
  t.plan_id,
  'MONTHLY',
  'ACTIVE',
  NOW(),
  NOW() + INTERVAL '1 year',
  p.price_monthly,
  'paymob',
  NOW(),
  NOW()
FROM "tenants" t
JOIN "plans" p ON p.id = t.plan_id
LEFT JOIN "subscriptions" s ON s.tenant_id = t.id
WHERE s.id IS NULL
  AND t.status = 'ACTIVE';
