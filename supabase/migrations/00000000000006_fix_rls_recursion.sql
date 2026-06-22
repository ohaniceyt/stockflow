-- Fix RLS policies that query the users table directly inside users-table policies,
-- causing "infinite recursion detected in policy for relation users".
-- Replace direct users subqueries with SECURITY DEFINER helpers.

-- Helpers
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM users WHERE id = auth.uid() AND is_active = TRUE LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_is_admin_or_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'super_admin') AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_user_is_operator_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'operator', 'super_admin') AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies: drop and recreate without direct users subqueries
DROP POLICY IF EXISTS users_org_admin_manage ON users;
CREATE POLICY users_org_admin_manage ON users
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND current_user_role() = 'admin'
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND role IN ('admin', 'operator', 'reader')
  );

-- Products policies: drop write policy and recreate with helper
DROP POLICY IF EXISTS products_org_admin_write ON products;
CREATE POLICY products_org_admin_write ON products
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND current_user_is_admin_or_super_admin()
  )
  WITH CHECK (org_id = current_user_org_id());

-- Movements policies: drop write policy and recreate with helper
DROP POLICY IF EXISTS movements_org_write ON movements;
CREATE POLICY movements_org_write ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_is_operator_or_above()
    AND operator_id = auth.uid()
  );

-- Activity logs policies: drop and recreate with helper
DROP POLICY IF EXISTS activity_logs_org_admin ON activity_logs;
CREATE POLICY activity_logs_org_admin ON activity_logs
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND current_user_is_admin_or_super_admin()
  )
  WITH CHECK (org_id = current_user_org_id());
