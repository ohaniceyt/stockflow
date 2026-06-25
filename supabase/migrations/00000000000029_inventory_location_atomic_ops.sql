-- Atomic inventory session creation + count update + default location swap

CREATE OR REPLACE FUNCTION create_inventory_session(
  p_org_id UUID,
  p_location_id UUID,
  p_name TEXT,
  p_operator_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_session_id UUID;
  v_product RECORD;
  v_current_stock INTEGER;
BEGIN
  -- Authorization
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND is_active = TRUE
      AND role IN ('admin', 'operator', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Validate location belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM locations
    WHERE id = p_location_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Emplacement invalide';
  END IF;

  INSERT INTO inventory_sessions (org_id, location_id, name, status, operator_id)
  VALUES (p_org_id, p_location_id, p_name, 'pending', p_operator_id)
  RETURNING id INTO v_session_id;

  FOR v_product IN
    SELECT id FROM products
    WHERE org_id = p_org_id AND is_active = TRUE
  LOOP
    SELECT quantity INTO v_current_stock
    FROM stock_levels
    WHERE product_id = v_product.id AND location_id = p_location_id;

    v_current_stock := COALESCE(v_current_stock, 0);

    INSERT INTO inventory_counts (
      session_id,
      product_id,
      location_id,
      theoretical_quantity,
      counted_quantity,
      difference,
      is_validated
    ) VALUES (
      v_session_id,
      v_product.id,
      p_location_id,
      v_current_stock,
      v_current_stock,
      0,
      FALSE
    );
  END LOOP;

  RETURN v_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_inventory_count(
  p_count_id UUID,
  p_counted_quantity INTEGER
)
RETURNS VOID AS $$
DECLARE
  v_count RECORD;
  v_session RECORD;
  v_operator_id UUID := auth.uid();
BEGIN
  SELECT c.*, s.org_id, s.status INTO v_count
  FROM inventory_counts c
  JOIN inventory_sessions s ON s.id = c.session_id
  WHERE c.id = p_count_id;

  IF v_count IS NULL THEN
    RAISE EXCEPTION 'Ligne de comptage introuvable';
  END IF;

  IF v_count.status != 'pending' THEN
    RAISE EXCEPTION 'La session est déjà appliquée ou annulée';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = v_operator_id
      AND org_id = v_count.org_id
      AND is_active = TRUE
      AND role IN ('admin', 'operator', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  UPDATE inventory_counts
  SET counted_quantity = p_counted_quantity,
      difference = p_counted_quantity - theoretical_quantity,
      is_validated = TRUE
  WHERE id = p_count_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION set_default_location(
  p_org_id UUID,
  p_location_id UUID
)
RETURNS VOID AS $$
BEGIN
  -- Authorization
  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = p_org_id
      AND is_active = TRUE
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Validate location belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM locations
    WHERE id = p_location_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Emplacement invalide';
  END IF;

  UPDATE locations
  SET is_default = FALSE
  WHERE org_id = p_org_id AND is_default = TRUE;

  UPDATE locations
  SET is_default = TRUE
  WHERE id = p_location_id AND org_id = p_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Security settings
ALTER FUNCTION public.create_inventory_session(UUID, UUID, TEXT, UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.update_inventory_count(UUID, INTEGER) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.set_default_location(UUID, UUID) SET search_path = pg_temp, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.create_inventory_session(UUID, UUID, TEXT, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_inventory_session(UUID, UUID, TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_inventory_session(UUID, UUID, TEXT, UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.update_inventory_count(UUID, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_inventory_count(UUID, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.update_inventory_count(UUID, INTEGER) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_default_location(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_default_location(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_default_location(UUID, UUID) TO authenticated;
