-- ETA submissions previously sent hardcoded placeholder values for the
-- issuer name and address (was "Storify Tenant" / "Main Street, 1, Cairo"
-- before the Hesba rebrand). The Egyptian Tax Authority validates these
-- against the registered taxpayer record, so they must come from the
-- tenant's actual business registration.
--
-- This migration adds the missing fields. Filling them is required before
-- ETA submissions will leave the `pending_setup` state and actually
-- transmit to https://api.invoicing.eta.gov.eg.
--
-- All columns are nullable: existing tenants keep their current behavior
-- (eta_status='pending_setup' until owner fills via Settings → Taxes).
ALTER TABLE tenant_settings
  ADD COLUMN IF NOT EXISTS eta_issuer_name           TEXT,
  ADD COLUMN IF NOT EXISTS eta_address_governate     VARCHAR(50),
  ADD COLUMN IF NOT EXISTS eta_address_region_city   VARCHAR(100),
  ADD COLUMN IF NOT EXISTS eta_address_street        VARCHAR(200),
  ADD COLUMN IF NOT EXISTS eta_address_building      VARCHAR(50);
