-- Server-side movement stats aggregation.
--
-- The dashboard and analytics screens used to aggregate movements client-side in
-- JS over `useMovements` (useInfiniteQuery, page of 25 rows) without ever calling
-- fetchNextPage. Every aggregate therefore ran over the 25 most-recent movements
-- only — a silent correctness bug that worsens as the org grows. `useFirstSale` had
-- the same defect (could stay `true` once the first cashier sale aged past page 1).
--
-- This migration adds:
--   1. A partial index on movements(org_id, created_at DESC) WHERE type='OUT'
--      AND is_cancelled=FALSE, serving every sales aggregate.
--   2. get_movement_stats(p_org_id, p_from, p_to) → JSONB, scoped by org + half-open
--      date range [p_from, p_to) (NULL = unbounded). Returns totals, daily_flux
--      (org-timezone buckets), top_products, product_balances, rotation. OUT rows
--      with is_cancelled=TRUE are excluded everywhere; IN cancelled rows are also
--      excluded for consistency.
--   3. has_cashier_sale(p_org_id) → BOOLEAN, for useFirstSale.
--
-- Both functions are SECURITY DEFINER with search_path = public, pg_catalog
-- (excludes pg_temp — search_path injection guard) and execute granted to
-- authenticated only. Membership is asserted against auth.uid() exactly like
-- record_movement (20260724000000 / 20260727000000).

-- Partial index for sales (OUT, non-cancelled) aggregates.
CREATE INDEX IF NOT EXISTS idx_movements_org_out_created
  ON movements (org_id, created_at DESC)
  WHERE type = 'OUT' AND is_cancelled = FALSE;

CREATE OR REPLACE FUNCTION get_movement_stats(
  p_org_id UUID,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_org_tz TEXT;
  v_totals JSONB;
  v_daily_flux JSONB;
  v_products JSONB;
  v_stock JSONB;
BEGIN
  -- Assert caller is an active member of p_org_id (same guard as record_movement).
  SELECT role INTO v_role
  FROM organization_memberships
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = TRUE;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas membre actif de cette organisation.';
  END IF;

  SELECT timezone INTO v_org_tz FROM organizations WHERE id = p_org_id;
  IF v_org_tz IS NULL THEN
    v_org_tz := 'Africa/Abidjan';
  END IF;

  -- A. Totals over the range (one row). movements_count counts every row in range
  -- (incl. cancelled / transfers / inventory) for completeness; in/out counts and
  -- quantities exclude cancelled rows.
  SELECT COALESCE(jsonb_build_object(
    'movements_count', COALESCE(COUNT(*), 0),
    'in_count', COALESCE(COUNT(*) FILTER (WHERE m.type = 'IN' AND m.is_cancelled = FALSE), 0),
    'out_count', COALESCE(COUNT(*) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0),
    'in_qty', COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN' AND m.is_cancelled = FALSE), 0),
    'out_qty', COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0),
    'revenue', COALESCE(SUM(m.quantity * m.unit_price) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0),
    'real_revenue', COALESCE(SUM(m.quantity * COALESCE(m.unit_price, pr.selling_price)) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0),
    'real_profit', COALESCE(SUM(m.quantity * (COALESCE(m.unit_price, pr.selling_price) - pr.cost_price)) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0),
    'estimated_revenue', COALESCE(SUM(m.quantity * pr.selling_price) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0),
    'estimated_margin', COALESCE(SUM(m.quantity * (pr.selling_price - pr.cost_price)) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0)
  ), '{}'::jsonb) INTO v_totals
  FROM movements m
  JOIN products pr ON pr.id = m.product_id
  WHERE m.org_id = p_org_id
    AND (p_from IS NULL OR m.created_at >= p_from)
    AND (p_to IS NULL OR m.created_at < p_to);

  -- B. Daily flux, bucketed by the org's local timezone.
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'day', day_text,
    'in_qty', in_qty,
    'out_qty', out_qty,
    'out_revenue', out_revenue
  ) ORDER BY day_text), '[]'::jsonb) INTO v_daily_flux
  FROM (
    SELECT
      to_char(date_trunc('day', m.created_at, v_org_tz) AT TIME ZONE v_org_tz, 'YYYY-MM-DD') AS day_text,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN' AND m.is_cancelled = FALSE), 0) AS in_qty,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0) AS out_qty,
      COALESCE(SUM(m.quantity * COALESCE(m.unit_price, pr.selling_price)) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0) AS out_revenue
    FROM movements m
    JOIN products pr ON pr.id = m.product_id
    WHERE m.org_id = p_org_id
      AND (p_from IS NULL OR m.created_at >= p_from)
      AND (p_to IS NULL OR m.created_at < p_to)
    GROUP BY date_trunc('day', m.created_at, v_org_tz)
  ) d;

  -- C. Per-product aggregation (feeds top_products + product_balances).
  -- Aggregates are computed in a subquery (you cannot nest SUM() inside
  -- jsonb_build_object inside jsonb_agg — Postgres forbids nested aggregates).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', s.product_id,
    'name', s.name,
    'unit', s.unit,
    'in_qty', s.in_qty,
    'out_qty', s.out_qty,
    'qty_sold', s.qty_sold,
    'revenue', s.revenue
  )), '[]'::jsonb) INTO v_products
  FROM (
    SELECT
      m.product_id,
      pr.name,
      pr.unit,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'IN' AND m.is_cancelled = FALSE), 0) AS in_qty,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0) AS out_qty,
      COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0) AS qty_sold,
      COALESCE(SUM(m.quantity * COALESCE(m.unit_price, pr.selling_price)) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0) AS revenue
    FROM movements m
    JOIN products pr ON pr.id = m.product_id
    WHERE m.org_id = p_org_id
      AND (p_from IS NULL OR m.created_at >= p_from)
      AND (p_to IS NULL OR m.created_at < p_to)
    GROUP BY m.product_id, pr.name, pr.unit
  ) s;

  -- D. Current stock per product (summed across locations; not bounded by range).
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'product_id', s.product_id,
    'current_qty', s.current_qty
  )), '[]'::jsonb) INTO v_stock
  FROM (
    SELECT
      sl.product_id,
      COALESCE(SUM(sl.quantity), 0) AS current_qty
    FROM stock_levels sl
    JOIN products pr ON pr.id = sl.product_id AND pr.org_id = p_org_id
    GROUP BY sl.product_id
  ) s;

  RETURN jsonb_build_object(
    'totals', v_totals,
    'daily_flux', v_daily_flux,
    'top_products', COALESCE((
      SELECT jsonb_agg(p ORDER BY (p->>'qty_sold')::int DESC)
      FROM (
        SELECT p
        FROM jsonb_array_elements(v_products) AS p
        WHERE (p->>'qty_sold')::int > 0
        ORDER BY (p->>'qty_sold')::int DESC
        LIMIT 10
      ) top
    ), '[]'::jsonb),
    'product_balances', COALESCE((
      SELECT jsonb_agg(p ORDER BY p->>'name')
      FROM jsonb_array_elements(v_products) AS p
      WHERE (p->>'in_qty')::int > 0 OR (p->>'out_qty')::int > 0
    ), '[]'::jsonb),
    'rotation', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'product_id', top.pid,
        'name', top.pname,
        'unit', top.punit,
        'sold_qty', top.sold,
        'current_qty', top.cur,
        'ratio', CASE WHEN top.cur > 0 THEN (top.sold::numeric / top.cur)::float ELSE 0 END
      ) ORDER BY (CASE WHEN top.cur > 0 THEN (top.sold::numeric / top.cur)::float ELSE 0 END) DESC)
      FROM (
        SELECT pid, pname, punit, sold, cur
        FROM (
          SELECT
            pr.id AS pid,
            pr.name AS pname,
            pr.unit AS punit,
            COALESCE(SUM(m.quantity) FILTER (WHERE m.type = 'OUT' AND m.is_cancelled = FALSE), 0) AS sold,
            COALESCE((SELECT SUM(sl.quantity) FROM stock_levels sl WHERE sl.product_id = pr.id), 0) AS cur
          FROM products pr
          LEFT JOIN movements m ON m.product_id = pr.id
            AND m.org_id = p_org_id
            AND (p_from IS NULL OR m.created_at >= p_from)
            AND (p_to IS NULL OR m.created_at < p_to)
          WHERE pr.org_id = p_org_id
          GROUP BY pr.id, pr.name, pr.unit
        ) base
        WHERE sold > 0
        ORDER BY (CASE WHEN cur > 0 THEN (sold::numeric / cur)::float ELSE 0 END) DESC
        LIMIT 10
      ) top
    ), '[]'::jsonb)
  );
END;
$$;

ALTER FUNCTION get_movement_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION get_movement_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION get_movement_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_movement_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

CREATE OR REPLACE FUNCTION has_cashier_sale(p_org_id UUID) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_role TEXT;
  v_exists BOOLEAN;
BEGIN
  SELECT role INTO v_role
  FROM organization_memberships
  WHERE user_id = auth.uid()
    AND org_id = p_org_id
    AND is_active = TRUE;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Accès refusé : vous n''êtes pas membre actif de cette organisation.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM movements
    WHERE org_id = p_org_id
      AND type = 'OUT'
      AND cashier_session_id IS NOT NULL
      AND is_cancelled = FALSE
  ) INTO v_exists;

  RETURN v_exists;
END;
$$;

ALTER FUNCTION has_cashier_sale(UUID) SET search_path = public, pg_catalog;
REVOKE EXECUTE ON FUNCTION has_cashier_sale(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION has_cashier_sale(UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION has_cashier_sale(UUID) TO authenticated;