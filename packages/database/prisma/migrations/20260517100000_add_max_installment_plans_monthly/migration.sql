-- Add per-month installment quota to plans table.
-- 0 = feature disabled (legacy default; matches existing rows on backfill)
-- The seed sets the real values: Starter=15, Pro=100, Enterprise=999999.
ALTER TABLE "plans"
  ADD COLUMN "max_installment_plans_monthly" INTEGER NOT NULL DEFAULT 0;
