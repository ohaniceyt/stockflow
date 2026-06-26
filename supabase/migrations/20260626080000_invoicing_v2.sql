-- Invoicing v2: enrich invoice/quote/delivery_note model and add payment tracking.
-- Keeps the existing polymorphic `invoices` table (type invoice|quote|delivery_note)
-- and extends it with delivery metadata + a dedicated payments table.

-- 1. Delivery-note specific fields on the polymorphic invoices table.
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_to_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Index for converted quotes lookup.
CREATE INDEX IF NOT EXISTS idx_invoices_converted_to_invoice_id ON invoices(converted_to_invoice_id);

-- 2. Payments table: tracks every payment against an invoice.
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'mobile_money', 'transfer', 'other')),
  reference TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_org_id ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

-- 3. RLS for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_payments ON payments;
CREATE POLICY org_isolation_payments ON payments
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN organization_memberships m ON m.org_id = i.org_id
    WHERE i.id = payments.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices i
    JOIN organization_memberships m ON m.org_id = i.org_id
    WHERE i.id = payments.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ));

-- 4. Trigger: keep invoices.paid_amount and status in sync with payments.
CREATE OR REPLACE FUNCTION sync_invoice_paid_amount()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
DECLARE
  v_invoice_id UUID;
  v_total NUMERIC(12,2);
  v_paid NUMERIC(12,2);
  v_new_status TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  SELECT total INTO v_total FROM invoices WHERE id = v_invoice_id;
  SELECT COALESCE(SUM(amount), 0) INTO v_paid FROM payments WHERE invoice_id = v_invoice_id;

  IF v_total = 0 THEN
    v_new_status := 'paid';
  ELSIF v_paid >= v_total THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    -- If it was previously paid/partial, reset to sent if a payment is removed.
    SELECT CASE WHEN status IN ('paid', 'partial') THEN 'sent' ELSE status END
    INTO v_new_status
    FROM invoices WHERE id = v_invoice_id;
  END IF;

  UPDATE invoices
  SET paid_amount = v_paid,
      status = v_new_status,
      updated_at = NOW()
  WHERE id = v_invoice_id;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_invoice_paid_amount ON payments;
CREATE TRIGGER trg_sync_invoice_paid_amount
  AFTER INSERT OR UPDATE OR DELETE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_invoice_paid_amount();

-- 5. Function: record a payment on an invoice (convenience RPC).
CREATE OR REPLACE FUNCTION record_invoice_payment(
  p_invoice_id UUID,
  p_amount NUMERIC(12,2),
  p_payment_method TEXT DEFAULT 'cash',
  p_reference TEXT DEFAULT NULL,
  p_paid_at TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
DECLARE
  v_org_id UUID;
  v_payment_id UUID;
BEGIN
  SELECT org_id INTO v_org_id FROM invoices WHERE id = p_invoice_id;
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;

  INSERT INTO payments (org_id, invoice_id, amount, payment_method, reference, paid_at)
  VALUES (v_org_id, p_invoice_id, p_amount, p_payment_method, p_reference, p_paid_at)
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_invoice_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_invoice_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_invoice_payment(UUID, NUMERIC, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;

-- 6. Function: convert a quote to an invoice atomically.
-- Copies items, assigns the invoice document number, and marks the quote converted.
CREATE OR REPLACE FUNCTION convert_quote_to_invoice(
  p_quote_id UUID,
  p_issue_date DATE DEFAULT CURRENT_DATE,
  p_due_date DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
DECLARE
  v_quote RECORD;
  v_org RECORD;
  v_invoice_id UUID;
  v_document_number TEXT;
BEGIN
  SELECT * INTO v_quote FROM invoices
  WHERE id = p_quote_id AND type = 'quote'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  IF v_quote.status = 'converted' THEN
    RAISE EXCEPTION 'Quote already converted';
  END IF;

  SELECT * INTO v_org FROM organizations WHERE id = v_quote.org_id;

  v_document_number := next_document_number(
    v_quote.org_id,
    'invoice',
    COALESCE(v_org.invoice_prefix, 'FA')
  );

  INSERT INTO invoices (
    org_id,
    contact_id,
    type,
    document_number,
    status,
    issue_date,
    due_date,
    currency,
    subtotal,
    tax_total,
    total,
    paid_amount,
    quote_id,
    movement_ids,
    note,
    terms
  )
  VALUES (
    v_quote.org_id,
    v_quote.contact_id,
    'invoice',
    v_document_number,
    'draft',
    p_issue_date,
    p_due_date,
    v_quote.currency,
    v_quote.subtotal,
    v_quote.tax_total,
    v_quote.total,
    0,
    v_quote.id,
    v_quote.movement_ids,
    v_quote.note,
    v_quote.terms
  )
  RETURNING id INTO v_invoice_id;

  INSERT INTO invoice_items (
    invoice_id,
    product_id,
    description,
    quantity,
    unit_price,
    tax_rate,
    discount_amount,
    total,
    created_at,
    updated_at
  )
  SELECT
    v_invoice_id,
    product_id,
    description,
    quantity,
    unit_price,
    tax_rate,
    discount_amount,
    total,
    NOW(),
    NOW()
  FROM invoice_items
  WHERE invoice_id = p_quote_id;

  UPDATE invoices
  SET status = 'converted',
      converted_to_invoice_id = v_invoice_id,
      updated_at = NOW()
  WHERE id = p_quote_id;

  RETURN v_invoice_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.convert_quote_to_invoice(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.convert_quote_to_invoice(UUID, DATE, DATE) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.convert_quote_to_invoice(UUID, DATE, DATE) TO authenticated;

-- 7. Grant service role / authenticated basics
