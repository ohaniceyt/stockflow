-- Atomic cashier checkout: link movements to receipts and cancel by receipt.

-- 1. Track who cancelled a receipt.
ALTER TABLE receipts
ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Extend record_movement so checkout can tag each OUT movement with the
--    receipt it belongs to (via reference_id).
DROP FUNCTION IF EXISTS public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID);

CREATE OR REPLACE FUNCTION record_movement(
  p_org_id UUID,
  p_product_id UUID,
  p_location_id UUID,
  p_target_location_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT,
  p_contact_id UUID,
  p_unit_price NUMERIC,
  p_cashier_session_id UUID DEFAULT NULL,
  p_client_operation_id UUID DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_operator_id UUID := auth.uid();
  v_org_id UUID := p_org_id;
  v_role TEXT;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_target_org_id UUID;
  v_target_current_stock INTEGER;
  v_target_new_stock INTEGER;
  v_delta INTEGER;
  v_movement_id UUID;
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF p_type NOT IN ('IN', 'OUT', 'INVENTORY', 'ADJUSTMENT', 'TRANSFER') THEN
    RAISE EXCEPTION 'Type de mouvement invalide';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  -- Resolve org and role. If p_org_id is provided, assert operator belongs to it.
  IF v_org_id IS NOT NULL THEN
    SELECT role INTO v_role
    FROM organization_memberships
    WHERE user_id = v_operator_id
      AND org_id = v_org_id
      AND is_active = TRUE;
  ELSE
    SELECT org_id, role INTO v_org_id, v_role
    FROM organization_memberships
    WHERE user_id = v_operator_id
      AND is_active = TRUE
    ORDER BY updated_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_role IS NULL OR v_org_id IS NULL THEN
    RAISE EXCEPTION 'Opérateur non trouvé ou inactif';
  END IF;

  IF p_type = 'OUT' AND v_role NOT IN ('super_admin', 'admin', 'operator', 'cashier') THEN
    RAISE EXCEPTION 'Rôle insuffisant pour effectuer une vente';
  END IF;

  IF p_type IN ('IN', 'ADJUSTMENT', 'TRANSFER', 'INVENTORY') AND v_role NOT IN ('super_admin', 'admin', 'operator') THEN
    RAISE EXCEPTION 'Rôle insuffisant pour effectuer ce type de mouvement';
  END IF;

  -- Validate product/location belong to the resolved org
  IF NOT EXISTS (
    SELECT 1
    FROM products p
    JOIN locations l ON l.id = p_location_id
    WHERE p.id = p_product_id
      AND p.org_id = v_org_id
      AND l.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Produit ou emplacement non autorisé';
  END IF;

  -- Validate contact when provided
  IF p_contact_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM contacts
      WHERE id = p_contact_id
        AND org_id = v_org_id
        AND (
          (p_type = 'IN' AND type = 'SUPPLIER')
          OR (p_type = 'OUT' AND type = 'CUSTOMER')
          OR p_type NOT IN ('IN', 'OUT')
        )
    ) THEN
      RAISE EXCEPTION 'Contact invalide pour ce type de mouvement';
    END IF;
  END IF;

  -- Validate cashier session when provided. Offline replay may target a closed
  -- session, but it must still belong to the same org/location/operator.
  IF p_cashier_session_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cashier_sessions
      WHERE id = p_cashier_session_id
        AND org_id = v_org_id
        AND location_id = p_location_id
        AND operator_id = v_operator_id
    ) THEN
      RAISE EXCEPTION 'Session de caisse invalide ou fermée';
    END IF;
  END IF;

  -- Idempotency: offline queued movements are replayed with a stable client
  -- operation id. If this id already exists, return the stored movement without
  -- modifying stock again.
  IF p_client_operation_id IS NOT NULL THEN
    SELECT id INTO v_movement_id
    FROM movements
    WHERE client_operation_id = p_client_operation_id
    LIMIT 1;

    IF v_movement_id IS NOT NULL THEN
      RETURN v_movement_id;
    END IF;
  END IF;

  -- Read current source stock
  SELECT quantity INTO v_current_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND location_id = p_location_id;
  v_current_stock := COALESCE(v_current_stock, 0);

  IF p_type = 'IN' THEN
    v_new_stock := v_current_stock + p_quantity;

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, v_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = stock_levels.quantity + p_quantity, updated_at = NOW();

  ELSIF p_type = 'OUT' THEN
    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant';
    END IF;
    v_new_stock := v_current_stock - p_quantity;

    UPDATE stock_levels
    SET quantity = v_new_stock, updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

  ELSIF p_type = 'TRANSFER' THEN
    IF p_target_location_id IS NULL THEN
      RAISE EXCEPTION 'Un transfert nécessite un emplacement cible';
    END IF;

    SELECT org_id INTO v_target_org_id
    FROM locations
    WHERE id = p_target_location_id;

    IF v_target_org_id != v_org_id THEN
      RAISE EXCEPTION 'Emplacement cible non autorisé';
    END IF;

    IF v_current_stock < p_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour le transfert';
    END IF;

    -- Decrement source
    UPDATE stock_levels
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

    -- Increment target
    SELECT quantity INTO v_target_current_stock
    FROM stock_levels
    WHERE product_id = p_product_id AND location_id = p_target_location_id;
    v_target_current_stock := COALESCE(v_target_current_stock, 0);
    v_target_new_stock := v_target_current_stock + p_quantity;

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_target_location_id, v_target_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = stock_levels.quantity + p_quantity, updated_at = NOW();

    -- Source movement
    INSERT INTO movements (
      org_id, product_id, location_id, target_location_id, type, quantity,
      stock_before, stock_after, reason, operator_id, contact_id, unit_price, client_operation_id, reference_id
    ) VALUES (
      v_org_id, p_product_id, p_location_id, p_target_location_id, 'TRANSFER', p_quantity,
      v_current_stock, v_current_stock - p_quantity,
      COALESCE(p_reason, 'Transfert vers autre emplacement'),
      v_operator_id, p_contact_id, NULL, p_client_operation_id, p_reference_id
    );

    -- Target movement
    INSERT INTO movements (
      org_id, product_id, location_id, target_location_id, type, quantity,
      stock_before, stock_after, reason, operator_id, contact_id, unit_price, client_operation_id, reference_id
    ) VALUES (
      v_org_id, p_product_id, p_target_location_id, p_location_id, 'TRANSFER', p_quantity,
      v_target_current_stock, v_target_new_stock,
      COALESCE(p_reason, 'Transfert depuis autre emplacement'),
      v_operator_id, p_contact_id, NULL, p_client_operation_id, p_reference_id
    )
    RETURNING id INTO v_movement_id;

    RETURN v_movement_id;

  ELSE
    -- INVENTORY / ADJUSTMENT
    v_new_stock := p_quantity;
    v_delta := ABS(v_new_stock - v_current_stock);

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, v_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = v_new_stock, updated_at = NOW();
  END IF;

  INSERT INTO movements (
    org_id, product_id, location_id, target_location_id, type, quantity,
    stock_before, stock_after, reason, operator_id, contact_id, unit_price, cashier_session_id, client_operation_id, reference_id
  ) VALUES (
    v_org_id, p_product_id, p_location_id, p_target_location_id, p_type,
    CASE WHEN p_type = 'ADJUSTMENT' THEN v_delta ELSE p_quantity END,
    v_current_stock, v_new_stock, p_reason, v_operator_id, p_contact_id,
    CASE WHEN p_type = 'OUT' THEN p_unit_price ELSE NULL END,
    p_cashier_session_id,
    p_client_operation_id,
    p_reference_id
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID, UUID) SET search_path = pg_temp, public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID, UUID) TO authenticated;

-- 3. Atomic checkout: creates the receipt, the receipt items and the linked OUT
--    movements in a single transaction.
CREATE OR REPLACE FUNCTION complete_sale(
  p_org_id UUID,
  p_location_id UUID,
  p_cashier_session_id UUID,
  p_contact_id UUID DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'cash',
  p_currency TEXT DEFAULT 'XOF',
  p_prefix TEXT DEFAULT 'REC',
  p_subtotal NUMERIC,
  p_tax_amount NUMERIC,
  p_total NUMERIC,
  p_amount_paid NUMERIC,
  p_change_due NUMERIC,
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
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  -- Resolve operator role and org membership
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

  -- The session must be open and belong to the operator/location/org.
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

  -- Empty cart guard
  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

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
    p_subtotal,
    p_tax_amount,
    p_total,
    p_amount_paid,
    p_change_due,
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
    COALESCE((item->>'total')::NUMERIC, 0)
  FROM jsonb_array_elements(p_items) AS item;

  -- Record each line as an OUT movement linked to the receipt.
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

  -- Keep the session revenue in sync.
  UPDATE cashier_sessions
  SET daily_revenue = COALESCE(daily_revenue, 0) + p_subtotal
  WHERE id = p_cashier_session_id;

  v_result := jsonb_build_object(
    'receipt_id', v_receipt_id,
    'document_number', v_document_number
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.complete_sale(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) SET search_path = pg_temp, public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, JSONB) TO authenticated;

-- 4. Cancel a receipt and reverse its movements atomically.
CREATE OR REPLACE FUNCTION cancel_sale(
  p_receipt_id UUID DEFAULT NULL,
  p_movement_id UUID DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_receipt RECORD;
  v_movement RECORD;
  v_current_stock INTEGER;
  v_operator_id UUID := auth.uid();
  v_role TEXT;
BEGIN
  IF v_operator_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  SELECT role INTO v_role
  FROM organization_memberships
  WHERE user_id = v_operator_id
    AND org_id = current_user_org_id()
    AND is_active = TRUE;

  IF v_role IS NULL OR v_role NOT IN ('super_admin', 'admin') THEN
    RAISE EXCEPTION 'Non autorisé à annuler une vente';
  END IF;

  IF p_receipt_id IS NOT NULL THEN
    SELECT * INTO v_receipt
    FROM receipts
    WHERE id = p_receipt_id
      AND org_id = current_user_org_id();

    IF v_receipt IS NULL THEN
      RAISE EXCEPTION 'Reçu introuvable';
    END IF;

    IF v_receipt.is_cancelled THEN
      RAISE EXCEPTION 'Reçu déjà annulé';
    END IF;

    -- Reverse every linked OUT movement that has not already been cancelled.
    FOR v_movement IN
      SELECT *
      FROM movements
      WHERE reference_id = p_receipt_id
        AND type = 'OUT'
        AND is_cancelled = FALSE
        AND org_id = current_user_org_id()
    LOOP
      SELECT quantity INTO v_current_stock
      FROM stock_levels
      WHERE product_id = v_movement.product_id
        AND location_id = v_movement.location_id;
      v_current_stock := COALESCE(v_current_stock, 0);

      UPDATE movements
      SET is_cancelled = TRUE,
          cancelled_by = v_operator_id,
          cancelled_at = NOW()
      WHERE id = v_movement.id;

      INSERT INTO movements (
        org_id,
        product_id,
        location_id,
        target_location_id,
        type,
        quantity,
        stock_before,
        stock_after,
        reason,
        contact_id,
        operator_id,
        unit_price,
        reference_id
      ) VALUES (
        v_movement.org_id,
        v_movement.product_id,
        v_movement.location_id,
        NULL,
        'ADJUSTMENT',
        v_movement.quantity,
        v_current_stock,
        v_current_stock + v_movement.quantity,
        'Annulation vente',
        v_movement.contact_id,
        v_operator_id,
        NULL,
        v_movement.id
      );

      INSERT INTO stock_levels (product_id, location_id, quantity)
      VALUES (v_movement.product_id, v_movement.location_id, v_current_stock + v_movement.quantity)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = stock_levels.quantity + v_movement.quantity, updated_at = NOW();
    END LOOP;

    UPDATE receipts
    SET is_cancelled = TRUE,
        cancelled_at = NOW(),
        cancelled_by = v_operator_id
    WHERE id = p_receipt_id;

    -- Roll back the session revenue if the session is still open.
    UPDATE cashier_sessions
    SET daily_revenue = GREATEST(COALESCE(daily_revenue, 0) - v_receipt.subtotal, 0)
    WHERE id = v_receipt.cashier_session_id
      AND status = 'open';

  ELSIF p_movement_id IS NOT NULL THEN
    -- Legacy single-movement cancellation fallback.
    SELECT * INTO v_movement
    FROM movements
    WHERE id = p_movement_id
      AND type = 'OUT'
      AND is_cancelled = FALSE
      AND org_id = current_user_org_id();

    IF v_movement IS NULL THEN
      RAISE EXCEPTION 'Vente introuvable ou déjà annulée';
    END IF;

    SELECT quantity INTO v_current_stock
    FROM stock_levels
    WHERE product_id = v_movement.product_id
      AND location_id = v_movement.location_id;
    v_current_stock := COALESCE(v_current_stock, 0);

    UPDATE movements
    SET is_cancelled = TRUE,
        cancelled_by = v_operator_id,
        cancelled_at = NOW()
    WHERE id = p_movement_id;

    INSERT INTO movements (
      org_id,
      product_id,
      location_id,
      target_location_id,
      type,
      quantity,
      stock_before,
      stock_after,
      reason,
      contact_id,
      operator_id,
      unit_price,
      reference_id
    ) VALUES (
      v_movement.org_id,
      v_movement.product_id,
      v_movement.location_id,
      NULL,
      'ADJUSTMENT',
      v_movement.quantity,
      v_current_stock,
      v_current_stock + v_movement.quantity,
      'Annulation vente',
      v_movement.contact_id,
      v_operator_id,
      NULL,
      v_movement.id
    );

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (v_movement.product_id, v_movement.location_id, v_current_stock + v_movement.quantity)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = stock_levels.quantity + v_movement.quantity, updated_at = NOW();

    -- If this movement belongs to a receipt, cancel the receipt as well.
    IF v_movement.reference_id IS NOT NULL THEN
      UPDATE receipts
      SET is_cancelled = TRUE,
          cancelled_at = NOW(),
          cancelled_by = v_operator_id
      WHERE id = v_movement.reference_id
        AND is_cancelled = FALSE;

      UPDATE cashier_sessions
      SET daily_revenue = GREATEST(COALESCE(daily_revenue, 0) - COALESCE((SELECT subtotal FROM receipts WHERE id = v_movement.reference_id), 0), 0)
      WHERE id = (SELECT cashier_session_id FROM receipts WHERE id = v_movement.reference_id)
        AND status = 'open';
    END IF;

  ELSE
    RAISE EXCEPTION 'Identifiant de reçu ou de mouvement requis';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.cancel_sale(UUID, UUID) SET search_path = pg_temp, public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.cancel_sale(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(UUID, UUID) TO authenticated;
