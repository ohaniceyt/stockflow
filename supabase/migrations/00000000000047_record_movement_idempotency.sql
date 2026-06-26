-- Make movements idempotent for offline replay by tracking a client operation id.
-- 1. Add the column to the movements table.
-- 2. Replace record_movement with a version that accepts p_client_operation_id,
--    returns the existing movement when replayed, and validates product/location
--    ownership before touching stock.
-- 3. Enforce uniqueness of non-null client operation ids.

ALTER TABLE movements ADD COLUMN IF NOT EXISTS client_operation_id UUID;

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
  p_client_operation_id UUID DEFAULT NULL
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
      stock_before, stock_after, reason, operator_id, contact_id, unit_price, client_operation_id
    ) VALUES (
      v_org_id, p_product_id, p_location_id, p_target_location_id, 'TRANSFER', p_quantity,
      v_current_stock, v_current_stock - p_quantity,
      COALESCE(p_reason, 'Transfert vers autre emplacement'),
      v_operator_id, p_contact_id, NULL, p_client_operation_id
    );

    -- Target movement
    INSERT INTO movements (
      org_id, product_id, location_id, target_location_id, type, quantity,
      stock_before, stock_after, reason, operator_id, contact_id, unit_price, client_operation_id
    ) VALUES (
      v_org_id, p_product_id, p_target_location_id, p_location_id, 'TRANSFER', p_quantity,
      v_target_current_stock, v_target_new_stock,
      COALESCE(p_reason, 'Transfert depuis autre emplacement'),
      v_operator_id, p_contact_id, NULL, p_client_operation_id
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
    stock_before, stock_after, reason, operator_id, contact_id, unit_price, cashier_session_id, client_operation_id
  ) VALUES (
    v_org_id, p_product_id, p_location_id, p_target_location_id, p_type,
    CASE WHEN p_type = 'ADJUSTMENT' THEN v_delta ELSE p_quantity END,
    v_current_stock, v_new_stock, p_reason, v_operator_id, p_contact_id,
    CASE WHEN p_type = 'OUT' THEN p_unit_price ELSE NULL END,
    p_cashier_session_id,
    p_client_operation_id
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID) SET search_path = pg_temp, public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID, UUID) TO authenticated;

-- Enforce idempotency at the database level for non-null client operation ids.
CREATE UNIQUE INDEX IF NOT EXISTS movements_client_operation_id_idx
  ON movements (client_operation_id)
  WHERE client_operation_id IS NOT NULL;
