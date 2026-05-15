-- Track per-item received quantity so a single PO can be fulfilled across
-- multiple receipts. Default 0 backfills existing rows safely; pre-existing
-- POs in 'received' state remain consistent because the API now uses this
-- column only on new receipts.
ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0;

-- Backfill: any PO already in 'received' state implicitly received everything,
-- so set received_quantity = quantity. Future partial receipts work normally.
UPDATE purchase_order_items poi
SET received_quantity = poi.quantity
FROM purchase_orders po
WHERE po.id = poi.order_id
  AND po.status = 'received';
