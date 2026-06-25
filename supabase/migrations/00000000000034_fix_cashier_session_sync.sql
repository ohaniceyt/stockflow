-- Fix sync of queued cashier sales
-- Allow a queued movement to be linked to its cashier session even if the session
-- has already been closed by the time the device comes back online.

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
  p_cashier_session_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_operator_id UUID := auth.uid();
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM organization_memberships
  WHERE user_id = v_operator_id
    AND org_id = p_org_id
    AND is_active = TRUE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non membre de l organisation';
  END IF;

  IF p_type = 'OUT' AND v_role NOT IN ('super_admin', 'admin', 'operator', 'cashier') THEN
    RAISE EXCEPTION 'Rôle insuffisant pour effectuer une vente';
  END IF;

  IF p_type IN ('IN', 'ADJUSTMENT', 'TRANSFER', 'INVENTORY') AND v_role NOT IN ('super_admin', 'admin', 'operator') THEN
    RAISE EXCEPTION 'Rôle insuffisant pour effectuer ce type de mouvement';
  END IF;

  -- Validate cashier session when provided. The session may already be closed
  -- (sale is replayed from offline queue after closure); we still require it to
  -- belong to the same org, location and operator for traceability.
  IF p_cashier_session_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cashier_sessions
      WHERE id = p_cashier_session_id
        AND location_id = p_location_id
        AND org_id = p_org_id
        AND operator_id = v_operator_id
    ) THEN
      RAISE EXCEPTION 'Session de caisse invalide ou fermée';
    END IF;
  END IF;

  SELECT jsonb_build_object(
    'id', gen_random_uuid(),
    'success', TRUE
  ) INTO v_result;

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
    cashier_session_id
  )
  SELECT
    p_org_id,
    p_product_id,
    p_location_id,
    p_target_location_id,
    p_type,
    p_quantity,
    COALESCE(sl.quantity, 0),
    CASE
      WHEN p_type = 'IN' THEN COALESCE(sl.quantity, 0) + p_quantity
      WHEN p_type = 'OUT' THEN GREATEST(COALESCE(sl.quantity, 0) - p_quantity, 0)
      WHEN p_type = 'ADJUSTMENT' THEN p_quantity
      WHEN p_type = 'TRANSFER' THEN GREATEST(COALESCE(sl.quantity, 0) - p_quantity, 0)
      ELSE COALESCE(sl.quantity, 0)
    END,
    p_reason,
    p_contact_id,
    v_operator_id,
    p_unit_price,
    p_cashier_session_id
  FROM stock_levels sl
  WHERE sl.product_id = p_product_id AND sl.location_id = p_location_id;

  IF NOT FOUND THEN
    INSERT INTO movements (
      org_id, product_id, location_id, target_location_id, type, quantity,
      stock_before, stock_after, reason, contact_id, operator_id, unit_price, cashier_session_id
    )
    VALUES (
      p_org_id, p_product_id, p_location_id, p_target_location_id, p_type, p_quantity,
      0,
      CASE WHEN p_type = 'IN' THEN p_quantity ELSE 0 END,
      p_reason, p_contact_id, v_operator_id, p_unit_price, p_cashier_session_id
    );
  END IF;

  IF p_type = 'IN' THEN
    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, p_quantity)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = stock_levels.quantity + p_quantity, updated_at = NOW();
  ELSIF p_type = 'OUT' THEN
    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, GREATEST(0 - p_quantity, 0))
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = GREATEST(stock_levels.quantity - p_quantity, 0), updated_at = NOW();
  ELSIF p_type = 'ADJUSTMENT' THEN
    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (p_product_id, p_location_id, p_quantity)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = p_quantity, updated_at = NOW();
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID) SET search_path = pg_temp, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID, NUMERIC, UUID) TO authenticated;
