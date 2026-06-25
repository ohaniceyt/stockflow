-- Add unit_price to movements to record sale price at time of OUT movement.
-- This decouples the transactional price from the product catalog price.
ALTER TABLE movements
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(15,2);

-- Update record_movement to accept optional unit price for OUT movements.
CREATE OR REPLACE FUNCTION record_movement(
  p_product_id UUID,
  p_location_id UUID,
  p_target_location_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT,
  p_contact_id UUID DEFAULT NULL,
  p_unit_price DECIMAL(15,2) DEFAULT NULL
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

  SELECT org_id INTO v_org_id
  FROM organization_memberships
  WHERE user_id = v_operator_id
    AND is_active = TRUE
  LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Opérateur non trouvé ou inactif';
  END IF;

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

  IF NOT EXISTS (
    SELECT 1 FROM products p
    JOIN locations l ON l.id = p_location_id
    WHERE p.id = p_product_id AND p.org_id = v_org_id AND l.org_id = v_org_id
  ) THEN
    RAISE EXCEPTION 'Produit ou emplacement non autorisé';
  END IF;

  SELECT quantity INTO v_current_stock
  FROM stock_levels
  WHERE product_id = p_product_id AND location_id = p_location_id;

  v_current_stock := COALESCE(v_current_stock, 0);

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

    UPDATE stock_levels
    SET quantity = quantity - p_quantity, updated_at = NOW()
    WHERE product_id = p_product_id AND location_id = p_location_id;

    SELECT quantity INTO v_target_current_stock
    FROM stock_levels
    WHERE product_id = p_product_id AND location_id = p_target_location_id;

    v_target_current_stock := COALESCE(v_target_current_stock, 0);
    v_target_new_stock := v_target_current_stock + p_quantity;

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_target_location_id, v_target_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = stock_levels.quantity + p_quantity, updated_at = NOW();

    INSERT INTO movements (
      product_id,
      location_id,
      target_location_id,
      type,
      quantity,
      stock_before,
      stock_after,
      reason,
      operator_id,
      contact_id,
      unit_price
    ) VALUES (
      p_product_id,
      p_location_id,
      p_target_location_id,
      'TRANSFER',
      p_quantity,
      v_current_stock,
      v_current_stock - p_quantity,
      COALESCE(p_reason, 'Transfert vers autre emplacement'),
      v_operator_id,
      p_contact_id,
      NULL
    )
    RETURNING id INTO v_movement_id;

    INSERT INTO movements (
      product_id,
      location_id,
      target_location_id,
      type,
      quantity,
      stock_before,
      stock_after,
      reason,
      operator_id,
      contact_id,
      unit_price
    ) VALUES (
      p_product_id,
      p_target_location_id,
      p_location_id,
      'TRANSFER',
      p_quantity,
      v_target_current_stock,
      v_target_new_stock,
      COALESCE(p_reason, 'Transfert depuis autre emplacement'),
      v_operator_id,
      p_contact_id,
      NULL
    );

    RETURN v_movement_id;

  ELSE
    v_new_stock := p_quantity;
    v_delta := ABS(v_new_stock - v_current_stock);

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, v_new_stock)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = v_new_stock, updated_at = NOW();
  END IF;

  INSERT INTO movements (
    product_id,
    location_id,
    target_location_id,
    type,
    quantity,
    stock_before,
    stock_after,
    reason,
    operator_id,
    contact_id,
    unit_price
  ) VALUES (
    p_product_id,
    p_location_id,
    p_target_location_id,
    p_type,
    CASE WHEN p_type = 'ADJUSTMENT' THEN v_delta ELSE p_quantity END,
    v_current_stock,
    v_new_stock,
    p_reason,
    v_operator_id,
    p_contact_id,
    CASE WHEN p_type = 'OUT' THEN p_unit_price ELSE NULL END
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, DECIMAL) SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, DECIMAL) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, DECIMAL) FROM authenticated;

-- Update the older 7-argument signature wrapper to avoid breaking existing callers.
CREATE OR REPLACE FUNCTION record_movement(
  p_product_id UUID,
  p_location_id UUID,
  p_target_location_id UUID,
  p_type TEXT,
  p_quantity INTEGER,
  p_reason TEXT,
  p_contact_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
BEGIN
  RETURN record_movement(p_product_id, p_location_id, p_target_location_id, p_type, p_quantity, p_reason, p_contact_id, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID) SET search_path = public, pg_catalog;
