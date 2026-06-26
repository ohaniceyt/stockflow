-- Update receipts/receipt_items schema to match the app implementation.
-- The previous foundation migration created a different shape; this aligns it.
-- Existing tables are empty in production, so destructive column changes are safe.

-- 1. receipts table
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS document_number TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS change_due NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Back-fill operator_id for existing rows using the session operator, if any.
UPDATE receipts
SET operator_id = cashier_sessions.operator_id
FROM cashier_sessions
WHERE receipts.operator_id IS NULL AND receipts.cashier_session_id = cashier_sessions.id;

-- Migrate any existing receipt_number into document_number.
UPDATE receipts
SET document_number = receipt_number
WHERE document_number IS NULL;

-- Drop old columns and constraints.
ALTER TABLE receipts
  DROP COLUMN IF EXISTS receipt_number,
  DROP COLUMN IF EXISTS total_amount,
  DROP COLUMN IF EXISTS issued_at,
  DROP COLUMN IF EXISTS note;

-- Ensure document_number is non-null going forward.
ALTER TABLE receipts
  ALTER COLUMN document_number SET NOT NULL;

-- 2. receipt_items table
ALTER TABLE receipt_items
  ADD COLUMN IF NOT EXISTS product_name TEXT,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Back-fill derived columns from old schema.
UPDATE receipt_items
SET product_name = COALESCE((SELECT name FROM products WHERE products.id = receipt_items.product_id), description),
    total = total_price
WHERE product_name IS NULL;

ALTER TABLE receipt_items
  DROP COLUMN IF EXISTS movement_id,
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS total_price;

-- Ensure product_id and product_name are non-null going forward.
ALTER TABLE receipt_items
  ALTER COLUMN product_id SET NOT NULL,
  ALTER COLUMN product_name SET NOT NULL;
