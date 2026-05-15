-- Tenant-level expense budgets. One row per category × period (monthly or
-- yearly). The amount is a target; actual spending is computed at read time
-- as SUM of approved expenses within the current period window.
CREATE TABLE IF NOT EXISTS expense_budgets (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID         NOT NULL REFERENCES expense_categories(id),
  period      VARCHAR(20)  NOT NULL DEFAULT 'monthly',
  amount      DECIMAL(15,4) NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_expense_budget_cat_period
  ON expense_budgets(category_id, period);
