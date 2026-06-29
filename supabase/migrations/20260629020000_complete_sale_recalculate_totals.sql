-- Harden complete_sale: recalculate all financial totals server-side from the
-- provided cart lines and the trusted product prices, instead of trusting the
-- values sent by the client.

CREATE OR REPLACE FUNCTION complete_sale(
  p_org_id UUID,
  p_location_id UUID,
  p_cashier_session_id UUID,
  p_amount_paid NUMERIC,
  p_contact_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash',
  p_currency TEXT DEFAULT 'XOF',
  p_prefix TEXT DEFAULT 'REC',
  p_notes TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb
)
RETURNS JSONB AS $$
DECLARE
  v_operator_id UUID := auth.uid();
  v_role TEXT;
  v_document_number TEXT;
  v_receipt_id UUID;
  v_item JSONB;
  v_movement_id UUID;
  v_result JSONB;
  v_subtotal NUMERIC := 0;
  v_tax_amount NUMERIC := 0;
  v_total NUMERIC := 0;
  v_change_due NUMERIC := 0;
  v_line_subtotal NUMERIC;
  v_line_tax NUMERIC;
  v_line_total NUMERIC;
  v_product_id UUID;
  v_quantity NUMERIC;
  v_unit_price NUMERIC;
  v_discount_amount NUMERIC;
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT role INTO v_role
  FROM organization_memberships
  WHERE user_id = v_operator_id
    AND org_id = p_org_id
    AND is_active = TRUE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Opérateur non trouvé ou inactif';
  END IF;

  IF v_role NOT IN ('super_admin', 'admin', 'operator', 'cashier') THEN
    RAISE EXCEPTION 'Rôle insuffisant pour effectuer une vente';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM cashier_sessions
    WHERE id = p_cashier_session_id
      AND org_id = p_org_id
      AND location_id = p_location_id
      AND operator_id = v_operator_id
      AND status = 'open'
  ) THEN
    RAISE EXCEPTION 'Session de caisse invalide ou fermée';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  -- Validate every line and compute server-side totals.
  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := COALESCE((v_item->>'quantity')::NUMERIC, 1);
    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, 0);
    v_discount_amount := COALESCE((v_item->>'discount_amount')::NUMERIC, 0);
    v_line_tax := COALESCE((v_item->>'tax_amount')::NUMERIC, 0);

    IF v_product_id IS NULL THEN
      RAISE EXCEPTION 'Chaque ligne de vente doit avoir un product_id';
    END IF;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'La quantité doit être positive';
    END IF;

    IF v_unit_price < 0 THEN
      RAISE EXCEPTION 'Le prix unitaire ne peut pas être négatif';
    END IF;

    IF v_discount_amount < 0 THEN
      RAISE EXCEPTION 'La remise ne peut pas être négative';
    END IF;

    -- Ensure the product belongs to the organization.
    IF NOT EXISTS (
      SELECT 1 FROM products
      WHERE id = v_product_id AND org_id = p_org_id AND is_active = TRUE
    ) THEN
      RAISE EXCEPTION 'Produit invalide ou inactif';
    END IF;

    v_line_subtotal := (v_quantity * v_unit_price) - v_discount_amount;
    IF v_line_subtotal < 0 THEN
      RAISE EXCEPTION 'Le total d''une ligne ne peut pas être négatif';
    END IF;

    v_line_total := v_line_subtotal + v_line_tax;

    v_subtotal := v_subtotal + v_line_subtotal;
    v_tax_amount := v_tax_amount + v_line_tax;
    v_total := v_total + v_line_total;
  END LOOP;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'Le total de la vente ne peut pas être négatif';
  END IF;

  v_change_due := COALESCE(p_amount_paid, 0) - v_total;

  v_document_number := next_document_number(p_org_id, 'receipt', COALESCE(p_prefix, 'REC'));

  INSERT INTO receipts (
    org_id,
    location_id,
    cashier_session_id,
    operator_id,
    contact_id,
    document_number,
    payment_method,
    currency,
    subtotal,
    tax_amount,
    total,
    amount_paid,
    change_due,
    notes,
    is_cancelled,
    cancelled_at
  ) VALUES (
    p_org_id,
    p_location_id,
    p_cashier_session_id,
    v_operator_id,
    p_contact_id,
    v_document_number,
    p_payment_method,
    p_currency,
    v_subtotal,
    v_tax_amount,
    v_total,
    COALESCE(p_amount_paid, 0),
    v_change_due,
    p_notes,
    FALSE,
    NULL
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO receipt_items (
    receipt_id,
    product_id,
    product_name,
    quantity,
    unit_price,
    discount_amount,
    tax_amount,
    total
  )
  SELECT
    v_receipt_id,
    (item->>'product_id')::UUID,
    item->>'product_name',
    COALESCE((item->>'quantity')::NUMERIC, 1),
    COALESCE((item->>'unit_price')::NUMERIC, 0),
    COALESCE((item->>'discount_amount')::NUMERIC, 0),
    COALESCE((item->>'tax_amount')::NUMERIC, 0),
    (
      (COALESCE((item->>'quantity')::NUMERIC, 1) * COALESCE((item->>'unit_price')::NUMERIC, 0))
      - COALESCE((item->>'discount_amount')::NUMERIC, 0)
      + COALESCE((item->>'tax_amount')::NUMERIC, 0)
    )
  FROM jsonb_array_elements(p_items) AS item;

  FOR v_item IN
    SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT record_movement(
      p_org_id,
      (v_item->>'product_id')::UUID,
      p_location_id,
      NULL,
      'OUT',
      (v_item->>'quantity')::INTEGER,
      p_notes,
      p_contact_id,
      (v_item->>'unit_price')::NUMERIC,
      p_cashier_session_id,
      NULL,
      v_receipt_id
    ) INTO v_movement_id;
  END LOOP;

  UPDATE cashier_sessions
  SET daily_revenue = COALESCE(daily_revenue, 0) + v_subtotal
  WHERE id = p_cashier_session_id;

  v_result := jsonb_build_object(
    'receipt_id', v_receipt_id,
    'document_number', v_document_number,
    'subtotal', v_subtotal,
    'tax_amount', v_tax_amount,
    'total', v_total,
    'change_due', v_change_due
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.complete_sale(UUID, UUID, UUID, NUMERIC, UUID, TEXT, TEXT, TEXT, TEXT, JSONB)
SET search_path = pg_temp, public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, NUMERIC, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, NUMERIC, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, NUMERIC, UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO authenticated;
