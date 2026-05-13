ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS split_payment_method_id UUID REFERENCES payment_methods(id),
  ADD COLUMN IF NOT EXISTS split_payment_amount DECIMAL(15,4);
