-- RPC: apply an inventory session, creating adjustment movements for differences
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
  -- Resolve session and permissions
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

  -- Only admin/operator/super_admin of the org can apply
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = v_operator_id
      AND org_id = v_org_id
      AND is_active = TRUE
      AND role IN ('admin', 'operator', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Non autorisé';
  END IF;

  -- Process each validated count with a difference
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

    -- Set stock to counted quantity
    INSERT INTO stock_levels (product_id, location_id, quantity)
    VALUES (v_count.product_id, v_count.location_id, v_count.counted_quantity)
    ON CONFLICT (product_id, location_id)
    DO UPDATE SET quantity = v_count.counted_quantity, updated_at = NOW();

    -- Record adjustment movement
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

  -- Mark session completed
  UPDATE inventory_sessions
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
