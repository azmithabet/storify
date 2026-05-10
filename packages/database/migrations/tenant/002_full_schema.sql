-- Migration 002: Full tenant schema — columns exactly match schema.tenant.prisma

-- ─── Extend 001 tables ────────────────────────────────────────────────────────

ALTER TABLE branches
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS phone   VARCHAR(50);

ALTER TABLE roles
  ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT false;

-- ─── tenant_settings ──────────────────────────────────────────────────────────

CREATE TABLE tenant_settings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_default VARCHAR(10)   NOT NULL DEFAULT 'EGP',
  vat_enabled      BOOLEAN       NOT NULL DEFAULT false,
  vat_rate         DECIMAL(5,2)  NOT NULL DEFAULT 14.00,
  logo_url         TEXT,
  print_template   TEXT,
  language         VARCHAR(10)   NOT NULL DEFAULT 'ar',
  timezone         VARCHAR(50)   NOT NULL DEFAULT 'Africa/Cairo',
  eta_enabled      BOOLEAN       NOT NULL DEFAULT false,
  eta_environment  VARCHAR(20)   NOT NULL DEFAULT 'preprod',
  eta_taxpayer_id  VARCHAR(50),
  eta_activity_code VARCHAR(20),
  eta_branch_code  VARCHAR(20)   NOT NULL DEFAULT '0',
  eta_client_id    TEXT,
  eta_client_secret TEXT,
  eta_signing_cert TEXT,
  eta_auto_submit  BOOLEAN       NOT NULL DEFAULT true,
  eta_doc_type     VARCHAR(20)   NOT NULL DEFAULT 'i',
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── categories ───────────────────────────────────────────────────────────────

CREATE TABLE categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(200) NOT NULL,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ─── tax_rates ────────────────────────────────────────────────────────────────

CREATE TABLE tax_rates (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(100) NOT NULL,
  rate       DECIMAL(5,2) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- ─── products ─────────────────────────────────────────────────────────────────

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  name        VARCHAR(300) NOT NULL,
  description TEXT,
  unit        VARCHAR(50) NOT NULL DEFAULT 'piece',
  image_url   TEXT,
  has_variants BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_category ON products(category_id);

-- ─── product_variants ─────────────────────────────────────────────────────────

CREATE TABLE product_variants (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku        VARCHAR(100) UNIQUE,
  barcode    VARCHAR(100) UNIQUE,
  attributes JSONB NOT NULL DEFAULT '{}',
  cost_price DECIMAL(15,4) NOT NULL,
  sell_price DECIMAL(15,4) NOT NULL,
  image_url  TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);

-- ─── stock ────────────────────────────────────────────────────────────────────

CREATE TABLE stock (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id   UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  branch_id    UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  quantity     INT NOT NULL DEFAULT 0,
  min_quantity INT NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (variant_id, branch_id)
);

CREATE INDEX idx_stock_branch ON stock(branch_id);

-- ─── stock_movements ──────────────────────────────────────────────────────────

CREATE TABLE stock_movements (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES branches(id),
  user_id    UUID NOT NULL REFERENCES users(id),
  type       VARCHAR(50) NOT NULL,
  quantity   INT NOT NULL,
  note       TEXT,
  reference  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stock_mvmt_branch ON stock_movements(branch_id);

-- ─── stock_transfers ──────────────────────────────────────────────────────────

CREATE TABLE stock_transfers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id UUID NOT NULL REFERENCES branches(id),
  to_branch_id   UUID NOT NULL REFERENCES branches(id),
  created_by     UUID NOT NULL REFERENCES users(id),
  approved_by    UUID REFERENCES users(id),
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transfers_from ON stock_transfers(from_branch_id);
CREATE INDEX idx_transfers_to   ON stock_transfers(to_branch_id);

-- ─── stock_transfer_items ─────────────────────────────────────────────────────

CREATE TABLE stock_transfer_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transfer_id UUID NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  variant_id  UUID NOT NULL REFERENCES product_variants(id),
  quantity    INT NOT NULL
);

CREATE INDEX idx_transfer_items ON stock_transfer_items(transfer_id);

-- ─── currencies ───────────────────────────────────────────────────────────────

CREATE TABLE currencies (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(10) NOT NULL UNIQUE,
  name         VARCHAR(100) NOT NULL,
  rate_to_base DECIMAL(15,6) NOT NULL,
  is_base      BOOLEAN NOT NULL DEFAULT false,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── payment_methods ──────────────────────────────────────────────────────────

CREATE TABLE payment_methods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(100) NOT NULL,
  type           VARCHAR(50) NOT NULL,
  fee_type       VARCHAR(20) NOT NULL DEFAULT 'none',
  fee_percentage DECIMAL(5,2) NOT NULL DEFAULT 0,
  fee_fixed      DECIMAL(10,2) NOT NULL DEFAULT 0,
  fee_bearer     VARCHAR(20) NOT NULL DEFAULT 'merchant',
  is_active      BOOLEAN NOT NULL DEFAULT true,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── customers ────────────────────────────────────────────────────────────────

CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(200) NOT NULL,
  phone          VARCHAR(50),
  national_id    VARCHAR(50),
  address        TEXT,
  notes          TEXT,
  credit_balance DECIMAL(15,4) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_customers_phone ON customers(phone);

-- ─── customer_documents ───────────────────────────────────────────────────────

CREATE TABLE customer_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id),
  doc_type    VARCHAR(100) NOT NULL,
  file_url    TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cust_docs ON customer_documents(customer_id);

-- ─── coupons ──────────────────────────────────────────────────────────────────

CREATE TABLE coupons (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code           VARCHAR(100) NOT NULL UNIQUE,
  discount_type  VARCHAR(20) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  min_amount     DECIMAL(15,4),
  max_uses       INT,
  used_count     INT NOT NULL DEFAULT 0,
  expires_at     TIMESTAMPTZ,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── product_discounts ────────────────────────────────────────────────────────

CREATE TABLE product_discounts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_type  VARCHAR(20) NOT NULL,
  discount_value DECIMAL(10,2) NOT NULL,
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_prod_discounts ON product_discounts(product_id);

-- ─── invoices ─────────────────────────────────────────────────────────────────

CREATE TABLE invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id         UUID NOT NULL REFERENCES branches(id),
  customer_id       UUID REFERENCES customers(id) ON DELETE SET NULL,
  cashier_id        UUID NOT NULL REFERENCES users(id),
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  currency_id       UUID NOT NULL REFERENCES currencies(id),
  coupon_id         UUID REFERENCES coupons(id) ON DELETE SET NULL,
  exchange_rate     DECIMAL(15,6) NOT NULL DEFAULT 1,
  subtotal          DECIMAL(15,4) NOT NULL,
  discount_amount   DECIMAL(15,4) NOT NULL DEFAULT 0,
  tax_total         DECIMAL(15,4) NOT NULL DEFAULT 0,
  fee_percentage    DECIMAL(5,2) NOT NULL DEFAULT 0,
  fee_fixed         DECIMAL(10,2) NOT NULL DEFAULT 0,
  fee_amount        DECIMAL(15,4) NOT NULL DEFAULT 0,
  fee_bearer        VARCHAR(20) NOT NULL DEFAULT 'merchant',
  fee_added_to_total BOOLEAN NOT NULL DEFAULT false,
  total_amount      DECIMAL(15,4) NOT NULL,
  paid_amount       DECIMAL(15,4) NOT NULL DEFAULT 0,
  status            VARCHAR(50) NOT NULL DEFAULT 'completed',
  notes             TEXT,
  -- ETA fields (v1.2)
  eta_uuid          VARCHAR(100),
  eta_long_id       VARCHAR(200),
  eta_internal_id   VARCHAR(50) UNIQUE,
  eta_status        VARCHAR(50) NOT NULL DEFAULT 'not_required',
  eta_submitted_at  TIMESTAMPTZ,
  eta_accepted_at   TIMESTAMPTZ,
  eta_qr_code       TEXT,
  eta_doc_type      VARCHAR(20),
  eta_error         JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_branch   ON invoices(branch_id, created_at DESC);
CREATE INDEX idx_invoices_customer ON invoices(customer_id, created_at DESC);
CREATE INDEX idx_invoices_status   ON invoices(status);

-- ─── invoice_items ────────────────────────────────────────────────────────────

CREATE TABLE invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  variant_id      UUID NOT NULL REFERENCES product_variants(id),
  tax_rate_id     UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  quantity        INT NOT NULL,
  unit_price      DECIMAL(15,4) NOT NULL,
  discount_amount DECIMAL(15,4) NOT NULL DEFAULT 0,
  tax_amount      DECIMAL(15,4) NOT NULL DEFAULT 0,
  subtotal        DECIMAL(15,4) NOT NULL
);

CREATE INDEX idx_invoice_items ON invoice_items(invoice_id);

-- ─── payment_fee_expenses ─────────────────────────────────────────────────────

CREATE TABLE payment_fee_expenses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  payment_method_id UUID NOT NULL REFERENCES payment_methods(id),
  fee_amount        DECIMAL(15,4) NOT NULL,
  branch_id         UUID NOT NULL REFERENCES branches(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payment_fees ON payment_fee_expenses(invoice_id);

-- ─── returns ──────────────────────────────────────────────────────────────────

CREATE TABLE returns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id),
  processed_by  UUID NOT NULL REFERENCES users(id),
  return_type   VARCHAR(20) NOT NULL,
  amount        DECIMAL(15,4) NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_returns ON returns(invoice_id);

-- ─── return_items ─────────────────────────────────────────────────────────────

CREATE TABLE return_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id  UUID NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity   INT NOT NULL,
  restock    BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_return_items ON return_items(return_id);

-- ─── installment_contracts ────────────────────────────────────────────────────

CREATE TABLE installment_contracts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id               UUID NOT NULL UNIQUE REFERENCES invoices(id),
  customer_id              UUID NOT NULL REFERENCES customers(id),
  approved_by              UUID REFERENCES users(id),
  currency_id              UUID NOT NULL REFERENCES currencies(id),
  exchange_rate_at_contract DECIMAL(15,6) NOT NULL DEFAULT 1,
  down_payment             DECIMAL(15,4) NOT NULL,
  installments_count       INT NOT NULL,
  monthly_amount           DECIMAL(15,4) NOT NULL,
  interest_rate            DECIMAL(5,2) NOT NULL DEFAULT 0,
  total_amount             DECIMAL(15,4) NOT NULL,
  first_due_date           DATE NOT NULL,
  status                   VARCHAR(50) NOT NULL DEFAULT 'pending_approval',
  guarantor_name           VARCHAR(200),
  guarantor_phone          VARCHAR(50),
  signature_url            TEXT,
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_installments_customer ON installment_contracts(customer_id);

-- ─── installment_payments ─────────────────────────────────────────────────────

CREATE TABLE installment_payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id        UUID NOT NULL REFERENCES installment_contracts(id) ON DELETE CASCADE,
  received_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  installment_number INT NOT NULL,
  amount_paid        DECIMAL(15,4) NOT NULL,
  due_date           DATE NOT NULL,
  paid_date          DATE,
  receipt_url        TEXT,
  status             VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_inst_payments ON installment_payments(contract_id);

-- ─── external_financing ───────────────────────────────────────────────────────

CREATE TABLE external_financing (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL UNIQUE REFERENCES invoices(id),
  company_name   VARCHAR(200) NOT NULL,
  reference_no   VARCHAR(200),
  commission_pct DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── suppliers ────────────────────────────────────────────────────────────────

CREATE TABLE suppliers (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(200) NOT NULL,
  phone        VARCHAR(50),
  email        VARCHAR(255),
  address      TEXT,
  tax_number   VARCHAR(100),
  bank_account TEXT,
  balance      DECIMAL(15,4) NOT NULL DEFAULT 0,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── supplier_transactions ────────────────────────────────────────────────────

CREATE TABLE supplier_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  branch_id   UUID NOT NULL REFERENCES branches(id),
  user_id     UUID NOT NULL REFERENCES users(id),
  type        VARCHAR(50) NOT NULL,
  amount      DECIMAL(15,4) NOT NULL,
  reference   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_supplier_txn ON supplier_transactions(supplier_id);

-- ─── purchase_orders ──────────────────────────────────────────────────────────

CREATE TABLE purchase_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id   UUID NOT NULL REFERENCES suppliers(id),
  branch_id     UUID NOT NULL REFERENCES branches(id),
  created_by    UUID NOT NULL REFERENCES users(id),
  approved_by   UUID REFERENCES users(id),
  status        VARCHAR(50) NOT NULL DEFAULT 'draft',
  total_amount  DECIMAL(15,4) NOT NULL,
  paid_amount   DECIMAL(15,4) NOT NULL DEFAULT 0,
  payment_type  VARCHAR(50),
  expected_date DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX idx_po_branch   ON purchase_orders(branch_id);

-- ─── purchase_order_items ─────────────────────────────────────────────────────

CREATE TABLE purchase_order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  quantity   INT NOT NULL,
  unit_cost  DECIMAL(15,4) NOT NULL,
  subtotal   DECIMAL(15,4) NOT NULL
);

CREATE INDEX idx_po_items ON purchase_order_items(order_id);

-- ─── purchase_receipts ────────────────────────────────────────────────────────

CREATE TABLE purchase_receipts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES purchase_orders(id),
  received_by       UUID NOT NULL REFERENCES users(id),
  received_date     DATE NOT NULL,
  notes             TEXT,
  invoice_image_url TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_receipts ON purchase_receipts(order_id);

-- ─── purchase_payments ────────────────────────────────────────────────────────

CREATE TABLE purchase_payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES purchase_orders(id),
  supplier_id    UUID NOT NULL REFERENCES suppliers(id),
  paid_by        UUID NOT NULL REFERENCES users(id),
  amount         DECIMAL(15,4) NOT NULL,
  payment_method VARCHAR(50),
  receipt_url    TEXT,
  paid_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_purchase_payments ON purchase_payments(order_id);

-- ─── expense_categories ───────────────────────────────────────────────────────

CREATE TABLE expense_categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      VARCHAR(200) NOT NULL,
  color     VARCHAR(20),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- ─── expenses ─────────────────────────────────────────────────────────────────

CREATE TABLE expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id      UUID NOT NULL REFERENCES branches(id),
  category_id    UUID NOT NULL REFERENCES expense_categories(id),
  created_by     UUID NOT NULL REFERENCES users(id),
  approved_by    UUID REFERENCES users(id),
  description    TEXT NOT NULL,
  amount         DECIMAL(15,4) NOT NULL,
  payment_method VARCHAR(50),
  receipt_url    TEXT,
  expense_date   DATE NOT NULL,
  status         VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_expenses_branch ON expenses(branch_id);
CREATE INDEX idx_expenses_date   ON expenses(expense_date);

-- ─── offline_queue ────────────────────────────────────────────────────────────

CREATE TABLE offline_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type    VARCHAR(100) NOT NULL,
  payload        JSONB NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL,
  synced_at      TIMESTAMPTZ,
  conflict       BOOLEAN NOT NULL DEFAULT false,
  conflict_data  JSONB
);

CREATE INDEX idx_offline_queue ON offline_queue(synced_at);

-- ─── print_templates ──────────────────────────────────────────────────────────

CREATE TABLE print_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type          VARCHAR(100) NOT NULL,
  name          VARCHAR(200) NOT NULL,
  html_template TEXT NOT NULL,
  is_default    BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── audit_logs ───────────────────────────────────────────────────────────────

CREATE TABLE audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  entity     VARCHAR(100) NOT NULL,
  entity_id  UUID,
  action     VARCHAR(50) NOT NULL,
  before     JSONB,
  after      JSONB,
  ip         VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity  ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_actor   ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_created ON audit_logs(created_at DESC);

-- ─── eta_submissions ──────────────────────────────────────────────────────────

CREATE TABLE eta_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  attempt_number  INT NOT NULL DEFAULT 1,
  direction       VARCHAR(20) NOT NULL,
  request_payload JSONB NOT NULL,
  response_body   JSONB,
  http_status     INT,
  eta_uuid        VARCHAR(100),
  status          VARCHAR(50) NOT NULL,
  error_code      VARCHAR(50),
  error_message   TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_eta_invoice ON eta_submissions(invoice_id, attempt_number);
CREATE INDEX idx_eta_status  ON eta_submissions(status, submitted_at);
