-- Track which payment method was used when recording each installment payment.
-- Nullable so existing rows are not affected.
ALTER TABLE installment_payments
  ADD COLUMN IF NOT EXISTS payment_method_id UUID REFERENCES payment_methods(id);
