-- Fix movement tracking semantics:
-- 1. ADJUSTMENT should record the absolute delta, not the final quantity.
-- 2. TRANSFER should record a positive movement for the source location (stock decrease)
--    and a distinct inbound movement for the target location (stock increase).

CREATE OR REPLACE FUNCTION record_movement(
  p_product_id UUID,
  p_location_id UUID,
  p_target_location_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
  v_operator_id UUID := auth.uid();
  v_org_id UUID;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_movement_id UUID;
  v_target_org_id UUID;
  v_target_current_stock INTEGER;
  v_target_new_stock INTEGER;
  v_delta INTEGER;
BEGIN
  IF p_type NOT IN ('IN', 'OUT', 'INVENTORY', 'ADJUSTMENT', 'TRANSFER') THEN
    RAISE EXCEPTION 'Type de mouvement invalide';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'La quantité doit être positive';
  END IF;

  -- Resolve operator org
  SELECT org_id INTO v_org_id
  FROM users
  WHERE id = v_operator_id AND is_active = TRUE;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Opérateur non trouvé ou inactif';
  END IF;

  -- Validate product and source location belong to org
  IF NOT EXISTS (
    SELECT 1 FROM products p
    JOIN locations l ON l.id = p_location_id
    WHERE p.id = p_product_id AND p.org_id = v_org_id AND l.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Produit ou emplacement non autorisé';
  END IF;

  -- Get current stock at source
  SELECT quantity INTO v_current_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND location_id = p_location_id;

  v_current_stock := COALESCE(v_current_stock, 0);

  -- Compute new stock and apply changes
  IF p_type = 'IN' THEN
    v_new_stock := v_current_stock + p_quantity;

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, v_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = v_new_stock, updated_at = NOW();

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

    -- Decrease source
    UPDATE stock_levels
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

    -- Increase target
    SELECT quantity INTO v_target_current_stock
    FROM stock_levels
    WHERE product_id = p_product_id AND location_id = p_target_location_id;

    v_target_current_stock := COALESCE(v_target_current_stock, 0);
    v_target_new_stock := v_target_current_stock + p_quantity;

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_target_location_id, v_target_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = stock_levels.quantity + p_quantity, updated_at = NOW();

    -- Record outbound movement from source
    INSERT INTO movements (
      product_id,
      location_id,
      target_location_id,
      type,
      quantity,
      stock_before,
      stock_after,
      reason,
      operator_id
    ) VALUES (
      p_product_id,
      p_location_id,
      p_target_location_id,
      'TRANSFER',
      p_quantity,
      v_current_stock,
      v_current_stock - p_quantity,
      COALESCE(p_reason, 'Transfert vers autre emplacement'),
      v_operator_id
    )
    RETURNING id INTO v_movement_id;

    -- Record inbound movement at target
    INSERT INTO movements (
      product_id,
      location_id,
      target_location_id,
      type,
      quantity,
      stock_before,
      stock_after,
      reason,
      operator_id
    ) VALUES (
      p_product_id,
      p_target_location_id,
      p_location_id,
      'TRANSFER',
      p_quantity,
      v_target_current_stock,
      v_target_new_stock,
      COALESCE(p_reason, 'Transfert depuis autre emplacement'),
      v_operator_id
    );

    RETURN v_movement_id;

  ELSE
    -- INVENTORY / ADJUSTMENT: set absolute quantity
    v_new_stock := p_quantity;
    v_delta := ABS(v_new_stock - v_current_stock);

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, v_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = v_new_stock, updated_at = NOW();
  END IF;

  -- Record single-location movement.
  -- For ADJUSTMENT, store the delta (positive) so reports sum real quantities moved.
  INSERT INTO movements (
    product_id,
    location_id,
    target_location_id,
    type,
    quantity,
    stock_before,
    stock_after,
    reason,
    operator_id
  ) VALUES (
    p_product_id,
    p_location_id,
    p_target_location_id,
    p_type,
    CASE WHEN p_type = 'ADJUSTMENT' THEN v_delta ELSE p_quantity END,
    v_current_stock,
    v_new_stock,
    p_reason,
    v_operator_id
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
