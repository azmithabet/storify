-- ─── Work Order → Invoice Integration (Phase 2a) ─────────────────────────────
-- Allows service-based invoice items that are not backed by a product variant.
-- variant_id becomes nullable: NULL means the line describes a service, not a
-- stock-tracked product.  Existing product invoices are unaffected (they still
-- carry a non-null variant_id).

-- 1. Make variant_id optional (service line items have no stock variant)
ALTER TABLE invoice_items ALTER COLUMN variant_id DROP NOT NULL;

-- 2. Add service reference + description snapshot for non-product lines
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES services(id);
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS line_description VARCHAR(500);

-- 3. Back-link: the invoice that was generated from this work order (one-to-one)
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workorder_invoice ON work_orders (invoice_id) WHERE invoice_id IS NOT NULL;
