-- Fix nullable feature flags and billing settings that have defaults.
-- The TypeScript Organization type expects boolean fields to be non-null.

-- Backfill any existing NULL values with defaults before the NOT NULL constraint takes effect.
UPDATE public.organizations
SET
  has_invoicing_enabled = COALESCE(has_invoicing_enabled, FALSE),
  has_tax_enabled = COALESCE(has_tax_enabled, FALSE),
  tax_name = COALESCE(tax_name, 'TVA'),
  tax_rate = COALESCE(tax_rate, 0),
  invoice_prefix = COALESCE(invoice_prefix, 'FA'),
  quote_prefix = COALESCE(quote_prefix, 'DEV'),
  delivery_note_prefix = COALESCE(delivery_note_prefix, 'BL'),
  receipt_prefix = COALESCE(receipt_prefix, 'REC');

ALTER TABLE public.organizations
ALTER COLUMN has_invoicing_enabled SET NOT NULL,
ALTER COLUMN has_invoicing_enabled SET DEFAULT FALSE,
ALTER COLUMN has_tax_enabled SET NOT NULL,
ALTER COLUMN has_tax_enabled SET DEFAULT FALSE,
ALTER COLUMN tax_name SET NOT NULL,
ALTER COLUMN tax_name SET DEFAULT 'TVA',
ALTER COLUMN tax_rate SET NOT NULL,
ALTER COLUMN tax_rate SET DEFAULT 0,
ALTER COLUMN invoice_prefix SET NOT NULL,
ALTER COLUMN invoice_prefix SET DEFAULT 'FA',
ALTER COLUMN quote_prefix SET NOT NULL,
ALTER COLUMN quote_prefix SET DEFAULT 'DEV',
ALTER COLUMN delivery_note_prefix SET NOT NULL,
ALTER COLUMN delivery_note_prefix SET DEFAULT 'BL',
ALTER COLUMN receipt_prefix SET NOT NULL,
ALTER COLUMN receipt_prefix SET DEFAULT 'REC';

-- Ensure the insert path in complete_onboarding provides the new non-null defaults.
-- The function already uses DEFAULT for omitted columns, so existing rows are covered by the backfill above.
