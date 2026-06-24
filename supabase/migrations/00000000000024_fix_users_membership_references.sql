-- Fix helper and RPC functions that still referenced the old users schema
-- (org_id / role / is_active columns moved to organization_memberships in migration 16).
-- Applying migration 23 on a post-refactor database revealed that record_movement
-- was still querying users.org_id and users.is_active, which no longer exist.

-- 1. Role / permission helpers
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role
    FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = current_user_org_id()
      AND is_active = TRUE
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_is_admin_or_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = current_user_org_id()
      AND is_active = TRUE
      AND role IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_is_operator_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = current_user_org_id()
      AND is_active = TRUE
      AND role IN ('admin', 'operator', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Inventory session application (was still checking users.org_id / role)
CREATE OR REPLACE FUNCTION apply_inventory_session(p_session_id UUID)
RETURNS VOID AS $$
DECLARE
  v_session RECORD;
  v_count RECORD;
  v_operator_id UUID := auth.uid();
  v_org_id UUID;
  v_current_stock INTEGER;
  v_location_id UUID;
BEGIN
  SELECT id, org_id, location_id, status INTO v_session
  FROM inventory_sessions
  WHERE id = p_session_id;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'Session introuvable';
  END IF;

  IF v_session.status != 'pending' THEN
    RAISE EXCEPTION 'La session doit être en attente pour être appliquée';
  END IF;

  v_org_id := v_session.org_id;
  v_location_id := v_session.location_id;

  IF NOT EXISTS (
    SELECT 1 FROM organization_memberships
    WHERE user_id = v_operator_id
      AND org_id = v_org_id
      AND is_active = TRUE
      AND role IN ('admin', 'operator', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  FOR v_count IN
    SELECT c.product_id, c.location_id, c.theoretical_quantity, c.counted_quantity, c.difference
    FROM inventory_counts c
    WHERE c.session_id = p_session_id AND c.is_validated = TRUE
  LOOP
    IF v_count.difference = 0 THEN
      CONTINUE;
    END IF;

    SELECT quantity INTO v_current_stock
    FROM stock_levels
    WHERE product_id = v_count.product_id AND location_id = v_count.location_id;

    v_current_stock := COALESCE(v_current_stock, 0);

    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (v_count.product_id, v_count.location_id, v_count.counted_quantity)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = v_count.counted_quantity, updated_at = NOW();

    INSERT INTO movements (
      product_id,
      location_id,
      type,
      quantity,
      stock_before,
      stock_after,
      reason,
      operator_id,
      reference_id
    ) VALUES (
      v_count.product_id,
      v_count.location_id,
      'ADJUSTMENT',
      GREATEST(v_count.counted_quantity - v_current_stock, v_current_stock - v_count.counted_quantity),
      v_current_stock,
      v_count.counted_quantity,
      'Ajustement inventaire',
      v_operator_id,
      p_session_id
    );
  END LOOP;

  UPDATE inventory_sessions
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Record movement (resolve org from organization_memberships, optional contact_id)
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
      contact_id
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
      p_contact_id
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
      contact_id
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
      p_contact_id
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
    contact_id
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
    p_contact_id
  )
  RETURNING id INTO v_movement_id;

  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fix search_path / revoke (mirrors migration 19 for the recreated functions)
ALTER FUNCTION public.current_user_role() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_user_is_admin_or_super_admin() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_user_is_operator_or_above() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.apply_inventory_session(UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID) SET search_path = pg_temp, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin_or_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_operator_or_above() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_inventory_session(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID) FROM anon;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin_or_super_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_operator_or_above() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_inventory_session(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID) FROM authenticated;
