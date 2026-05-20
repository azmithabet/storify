-- ─── Services & Work Orders ──────────────────────────────────────────────────
-- Gated by the `services` plan feature. Stores that sell services alongside
-- (or instead of) products: mobile repair, auto repair, salons, etc.
--
-- Service is the catalog (what we offer).
-- WorkOrder is the instance (a job being performed for a specific customer),
-- with a status workflow and audit trail.
--
-- Payment is tracked on the work order itself (paymentMethodId/paidAt) so this
-- first cut doesn't have to thread services through POS / invoices / returns /
-- ETA. Invoice integration is Phase 2.

CREATE TABLE IF NOT EXISTS service_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS services (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        VARCHAR(200) NOT NULL,
  description                 TEXT,
  category_id                 UUID REFERENCES service_categories(id),
  default_price               DECIMAL(15, 4) NOT NULL,
  estimated_duration_minutes  INTEGER,
  is_active                   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_active ON services (is_active);

CREATE TABLE IF NOT EXISTS work_orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number      VARCHAR(50) NOT NULL UNIQUE,
  branch_id          UUID NOT NULL REFERENCES branches(id),
  customer_id        UUID REFERENCES customers(id),
  assigned_user_id   UUID REFERENCES users(id),
  created_by_id      UUID NOT NULL REFERENCES users(id),

  -- itemType is intentionally a string, not an enum, so adding new business
  -- types later doesn't require a migration. Values: device|vehicle|appointment|other
  item_type          VARCHAR(30) NOT NULL,
  item_details       JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- received|scheduled|diagnosed|quoted|approved|in_progress|ready|delivered|cancelled
  status             VARCHAR(30) NOT NULL DEFAULT 'received',

  scheduled_at       TIMESTAMPTZ,
  deposit            DECIMAL(15, 4) NOT NULL DEFAULT 0,
  estimated_total    DECIMAL(15, 4),
  final_total        DECIMAL(15, 4),

  payment_method_id  UUID REFERENCES payment_methods(id),
  paid_amount        DECIMAL(15, 4) NOT NULL DEFAULT 0,
  paid_at            TIMESTAMPTZ,

  diagnosis_notes    TEXT,
  work_notes         TEXT,
  customer_notes     TEXT,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at          TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_workorder_branch ON work_orders (branch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workorder_customer ON work_orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_workorder_status ON work_orders (status);

CREATE TABLE IF NOT EXISTS work_order_services (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  service_id    UUID NOT NULL REFERENCES services(id),
  quantity      INTEGER NOT NULL DEFAULT 1,
  unit_price    DECIMAL(15, 4) NOT NULL,
  notes         TEXT
);
CREATE INDEX IF NOT EXISTS idx_workorder_services_wo ON work_order_services (work_order_id);

CREATE TABLE IF NOT EXISTS work_order_status_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  old_status    VARCHAR(30),
  new_status    VARCHAR(30) NOT NULL,
  changed_by_id UUID NOT NULL REFERENCES users(id),
  note          TEXT,
  changed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_workorder_history_wo ON work_order_status_history (work_order_id, changed_at DESC);
