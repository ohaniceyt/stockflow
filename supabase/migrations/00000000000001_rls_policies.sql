-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Helper: is_super_admin()
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin' AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper: current_user_org_id()
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT org_id FROM users WHERE id = auth.uid() AND is_active = TRUE LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Organizations: super_admin full access, users see their own org
CREATE POLICY org_super_admin_all ON organizations
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY org_user_read ON organizations
  FOR SELECT TO authenticated USING (id = current_user_org_id());

-- Users: super_admin all, same org users readable by admin/operator/reader
CREATE POLICY users_super_admin_all ON users
  FOR ALL TO authenticated USING (is_super_admin()) WITH CHECK (is_super_admin());

CREATE POLICY users_org_read ON users
  FOR SELECT TO authenticated USING (org_id = current_user_org_id());

CREATE POLICY users_org_admin_manage ON users
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin' AND is_active = TRUE
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND role IN ('admin', 'operator', 'reader')
  );

-- Locations: org scoped
CREATE POLICY locations_org_all ON locations
  FOR ALL TO authenticated
  USING (org_id = current_user_org_id())
  WITH CHECK (org_id = current_user_org_id());

-- Products: org scoped
CREATE POLICY products_org_read ON products
  FOR SELECT TO authenticated USING (org_id = current_user_org_id() AND is_active = TRUE);

CREATE POLICY products_org_admin_write ON products
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND is_active = TRUE
    )
  )
  WITH CHECK (org_id = current_user_org_id());

-- Stock levels: org scoped (readable by all roles)
CREATE POLICY stock_levels_org_read ON stock_levels
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p JOIN locations l ON l.id = stock_levels.location_id
    WHERE p.id = stock_levels.product_id AND p.org_id = current_user_org_id() AND l.org_id = current_user_org_id()
  ));

-- Movements: org scoped
CREATE POLICY movements_org_read ON movements
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM products p JOIN locations l ON l.id = movements.location_id
    WHERE p.id = movements.product_id AND p.org_id = current_user_org_id() AND l.org_id = current_user_org_id()
  ));

CREATE POLICY movements_org_write ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.is_active = TRUE
        AND u.role IN ('admin', 'operator', 'super_admin')
        AND u.org_id = current_user_org_id()
    )
    AND operator_id = auth.uid()
  );

-- Activity logs: admin/super_admin only, org scoped
CREATE POLICY activity_logs_org_admin ON activity_logs
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND is_active = TRUE
    )
  )
  WITH CHECK (org_id = current_user_org_id());

-- Alerts: org scoped
CREATE POLICY alerts_org_all ON alerts
  FOR ALL TO authenticated
  USING (org_id = current_user_org_id())
  WITH CHECK (org_id = current_user_org_id());

-- Inventory sessions & counts: org scoped
CREATE POLICY inventory_sessions_org_all ON inventory_sessions
  FOR ALL TO authenticated
  USING (org_id = current_user_org_id())
  WITH CHECK (org_id = current_user_org_id());

CREATE POLICY inventory_counts_org_all ON inventory_counts
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM inventory_sessions s
    WHERE s.id = inventory_counts.session_id AND s.org_id = current_user_org_id()
  ));
