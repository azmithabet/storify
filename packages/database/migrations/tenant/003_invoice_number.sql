-- Migration 003: Add invoice_number column
-- Applied after 002_full_schema.sql

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(50) UNIQUE;
