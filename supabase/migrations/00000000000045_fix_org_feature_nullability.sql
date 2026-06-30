-- Fix nullable feature flags and billing settings that have defaults.
-- The TypeScript Organization type expects boolean fields to be non-null.
--
-- These columns are added later by migration 00000000000048_invoices_receipts.sql,
-- so this migration guards each column with IF EXISTS before using it.

DO $$
BEGIN
  -- Backfill any existing NULL values with defaults before the NOT NULL constraint takes effect.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'has_invoicing_enabled'
  ) THEN
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
  END IF;
END $$;

-- Apply NOT NULL / DEFAULT constraints only for columns that exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'has_invoicing_enabled'
  ) THEN
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
  END IF;
END $$;
