-- Fix record_invoice_payment: when p_paid_at is NULL, default to NOW().
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
  VALUES (v_org_id, p_invoice_id, p_amount, p_payment_method, p_reference, COALESCE(p_paid_at, NOW()))
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$;
