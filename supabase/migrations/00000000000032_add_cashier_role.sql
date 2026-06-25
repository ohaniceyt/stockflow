-- Add cashier role to organization membership model

-- 1. Widen membership role constraint
ALTER TABLE organization_memberships
DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

ALTER TABLE organization_memberships
ADD CONSTRAINT organization_memberships_role_check
CHECK (role IN ('super_admin', 'admin', 'operator', 'cashier', 'reader'));

-- 2. Widen invitation role constraint
ALTER TABLE invitations
DROP CONSTRAINT IF EXISTS invitations_role_check;

ALTER TABLE invitations
ADD CONSTRAINT invitations_role_check
CHECK (role IN ('admin', 'operator', 'cashier', 'reader'));

-- 3. Update permission helper to treat cashier as operator-or-above for writing movements
CREATE OR REPLACE FUNCTION current_user_is_operator_or_above()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM organization_memberships
    WHERE user_id = auth.uid()
      AND org_id = current_user_org_id()
      AND is_active = TRUE
      AND role IN ('admin', 'operator', 'cashier', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.current_user_is_operator_or_above() SET search_path = pg_temp, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.current_user_is_operator_or_above() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_operator_or_above() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_is_operator_or_above() TO authenticated;

-- 4. Allow cashier to insert movements through direct RLS
DROP POLICY IF EXISTS movements_org_write ON movements;
CREATE POLICY movements_org_write ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'operator', 'cashier', 'super_admin')
    )
    AND operator_id = auth.uid()
  );
