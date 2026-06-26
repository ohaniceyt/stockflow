-- Add missing total column to receipts and back-fill from subtotal + tax.
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS total NUMERIC(12,2) NOT NULL DEFAULT 0;

UPDATE receipts
SET total = subtotal + tax_amount
WHERE total = 0;
