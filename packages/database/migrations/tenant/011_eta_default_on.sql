-- Flip the eta_enabled default to TRUE. VAT-registered Egyptian businesses
-- are legally required to submit e-invoices to ETA, so the platform now
-- ships with it on. Stores that are VAT-exempt can disable from Settings →
-- Taxes.
--
-- Existing tenants are left as-is — flipping a live store's setting could
-- start submitting invoices to ETA without the owner having entered their
-- credentials. Owners opt in at their pace.
ALTER TABLE tenant_settings ALTER COLUMN eta_enabled SET DEFAULT TRUE;
