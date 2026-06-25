-- Dedicated RPC for anonymous storefront/API orders.
--
-- Storefront and public API orders are initiated by unauthenticated callers
-- (public visitor or API key). They cannot provide a user JWT, so calling the
-- regular record_movement (which relies on auth.uid()) from an Edge Function
-- service client would fail. This RPC performs the same stock validation and
-- decrement while accepting an explicit org/location and a customer contact.

CREATE OR REPLACE FUNCTION record_storefront_order(
  p_org_id UUID,
  p_location_id UUID,
  p_contact_id UUID,
  p_items JSONB,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_product_id UUID;
  v_quantity INTEGER;
  v_unit_price NUMERIC;
  v_selling_price NUMERIC;
  v_current_stock INTEGER;
  v_new_stock INTEGER;
  v_movement_id UUID;
  v_result JSONB := jsonb_build_object('movement_ids', jsonb_build_array());
BEGIN
  IF p_org_id IS NULL OR p_location_id IS NULL OR p_contact_id IS NULL THEN
    RAISE EXCEPTION 'Paramètres invalides';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Le panier est vide';
  END IF;

  -- Validate contact belongs to org and is a customer
  IF NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE id = p_contact_id AND org_id = p_org_id AND type = 'CUSTOMER'
  ) THEN
    RAISE EXCEPTION 'Contact client invalide';
  END IF;

  -- Validate location belongs to org
  IF NOT EXISTS (
    SELECT 1 FROM locations
    WHERE id = p_location_id AND org_id = p_org_id
  ) THEN
    RAISE EXCEPTION 'Emplacement invalide';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product_id := (v_item->>'product_id')::UUID;
    v_quantity := (v_item->>'quantity')::INTEGER;

    IF v_product_id IS NULL OR v_quantity IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'Article invalide dans la commande';
    END IF;

    -- Product must belong to org and be active
    SELECT selling_price INTO v_selling_price
    FROM products
    WHERE id = v_product_id AND org_id = p_org_id AND is_active = TRUE;

    IF v_selling_price IS NULL THEN
      RAISE EXCEPTION 'Produit non disponible';
    END IF;

    v_unit_price := COALESCE((v_item->>'unit_price')::NUMERIC, v_selling_price);

    -- Check and decrement stock
    SELECT quantity INTO v_current_stock
    FROM stock_levels
    WHERE product_id = v_product_id AND location_id = p_location_id;
    v_current_stock := COALESCE(v_current_stock, 0);

    IF v_current_stock < v_quantity THEN
      RAISE EXCEPTION 'Stock insuffisant pour le produit %', v_product_id;
    END IF;

    v_new_stock := v_current_stock - v_quantity;

    UPDATE stock_levels
    SET quantity = v_new_stock, updated_at = NOW()
    WHERE product_id = v_product_id AND location_id = p_location_id;

    INSERT INTO movements (
      org_id, product_id, location_id, target_location_id, type, quantity,
      stock_before, stock_after, reason, operator_id, contact_id, unit_price
    ) VALUES (
      p_org_id, v_product_id, p_location_id, NULL, 'OUT', v_quantity,
      v_current_stock, v_new_stock,
      COALESCE(p_reason, 'Commande storefront/API'),
      NULL, p_contact_id, v_unit_price
    )
    RETURNING id INTO v_movement_id;

    v_result := jsonb_set(
      v_result,
      '{movement_ids}',
      (v_result->'movement_ids') || jsonb_build_array(v_movement_id)
    );
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.record_storefront_order(UUID, UUID, UUID, JSONB, TEXT) SET search_path = public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.record_storefront_order(UUID, UUID, UUID, JSONB, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_storefront_order(UUID, UUID, UUID, JSONB, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_storefront_order(UUID, UUID, UUID, JSONB, TEXT) TO authenticated;
