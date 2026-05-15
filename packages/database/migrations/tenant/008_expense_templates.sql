-- Reusable expense presets. Admins instantiate a template to create a new
-- pending expense with today's date — useful for predictable monthly costs.
CREATE TABLE IF NOT EXISTS expense_templates (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(200) NOT NULL,
  description    TEXT         NOT NULL,
  amount         DECIMAL(15,4) NOT NULL,
  category_id    UUID         NOT NULL REFERENCES expense_categories(id),
  branch_id      UUID         REFERENCES branches(id),
  payment_method VARCHAR(50),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  last_used_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
