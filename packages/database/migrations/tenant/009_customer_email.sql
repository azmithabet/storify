-- Optional email address per customer. Used for invoice receipts and
-- (eventually) password-style flows. Nullable so existing rows aren't touched.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(255);
