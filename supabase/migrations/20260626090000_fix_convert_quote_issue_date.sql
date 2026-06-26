-- Fix convert_quote_to_invoice: when p_issue_date is NULL, default to CURRENT_DATE.
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
    terms,
    delivery_address,
    delivered_at,
    converted_to_invoice_id
  )
  VALUES (
    v_quote.org_id,
    v_quote.contact_id,
    'invoice',
    v_document_number,
    'draft',
    COALESCE(p_issue_date, CURRENT_DATE),
    p_due_date,
    v_quote.currency,
    v_quote.subtotal,
    v_quote.tax_total,
    v_quote.total,
    0,
    v_quote.id,
    v_quote.movement_ids,
    v_quote.note,
    v_quote.terms,
    v_quote.delivery_address,
    NULL,
    NULL
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
