-- Cashier sessions and sale cancellation support

-- 1. Add cancellation columns to movements
ALTER TABLE movements
ADD COLUMN IF NOT EXISTS is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS cancelled_by UUID,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cashier_session_id UUID;

-- 2. Create cashier_sessions table
CREATE TABLE IF NOT EXISTS cashier_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  closing_balance NUMERIC(12, 2),
  daily_revenue NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_movements_cashier_session_id ON movements(cashier_session_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_org_location ON cashier_sessions(org_id, location_id);
CREATE INDEX IF NOT EXISTS idx_cashier_sessions_status ON cashier_sessions(status);

-- Prevent two open cashier sessions on the same location.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashier_sessions_open_location
  ON cashier_sessions(location_id)
  WHERE status = 'open';

-- 4. Enable RLS on cashier_sessions
ALTER TABLE cashier_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS policies for cashier_sessions
DROP POLICY IF EXISTS cashier_sessions_org_select ON cashier_sessions;
CREATE POLICY cashier_sessions_org_select ON cashier_sessions
  FOR SELECT TO authenticated
  USING (org_id = current_user_org_id());

DROP POLICY IF EXISTS cashier_sessions_org_insert ON cashier_sessions;
CREATE POLICY cashier_sessions_org_insert ON cashier_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = current_user_org_id()
    AND operator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'operator', 'cashier', 'super_admin')
    )
  );

DROP POLICY IF EXISTS cashier_sessions_org_update ON cashier_sessions;
CREATE POLICY cashier_sessions_org_update ON cashier_sessions
  FOR UPDATE TO authenticated
  USING (
    org_id = current_user_org_id()
    AND operator_id = auth.uid()
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND operator_id = auth.uid()
  );

-- 6. Helper: check if current user can cancel sales
CREATE OR REPLACE FUNCTION current_user_can_cancel_sales()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = current_user_org_id()
      AND is_active = TRUE
      AND role IN ('super_admin', 'admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.current_user_can_cancel_sales() SET search_path = pg_temp, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.current_user_can_cancel_sales() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_cancel_sales() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_can_cancel_sales() TO authenticated;

-- 8. Security definer RPC to cancel a sale (enforces admin/super_admin)
CREATE OR REPLACE FUNCTION cancel_sale(p_movement_id UUID)
RETURNS VOID AS $$
DECLARE
  v_movement RECORD;
  v_current_stock INTEGER;
BEGIN
  IF NOT current_user_can_cancel_sales() THEN
    RAISE EXCEPTION 'Non autorisé à annuler une vente';
  END IF;

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

  -- Mark the sale as cancelled
  UPDATE movements
  SET is_cancelled = TRUE,
      cancelled_by = auth.uid(),
      cancelled_at = NOW()
  WHERE id = p_movement_id;

  -- Create an adjustment movement to restore stock
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
  )
  VALUES (
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
    auth.uid(),
    NULL,
    v_movement.id
  );

  -- Restore stock level
  INSERT INTO stock_levels (product_id, location_id, quantity)
  VALUES (v_movement.product_id, v_movement.location_id, v_current_stock + v_movement.quantity)
  ON CONFLICT (product_id, location_id)
  DO UPDATE SET quantity = stock_levels.quantity + v_movement.quantity, updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.cancel_sale(UUID) SET search_path = pg_temp, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cancel_sale(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_sale(UUID) TO authenticated;

-- 9. Update record_movement to link cashier_session_id and validate session
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

  IF p_cashier_session_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM cashier_sessions
      WHERE id = p_cashier_session_id
        AND location_id = p_location_id
        AND org_id = p_org_id
        AND status = 'open'
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
