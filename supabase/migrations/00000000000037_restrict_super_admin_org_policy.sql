-- Restrict the overly-permissive organizations super-admin policy.
-- The original `org_super_admin_all` granted any organization super_admin
-- FULL access to ALL organizations. This drops it and replaces it with
-- scoped policies that only allow actions on the user's current organization.

-- Drop the permissive cross-organization policy.
DROP POLICY IF EXISTS org_super_admin_all ON organizations;

-- Scoped write policy: only admins/super_admins of the current org can update
-- organizations they belong to. Platform admins continue to use the separate
-- organizations_platform_read / platform_admin helpers in Edge Functions.
CREATE POLICY organizations_org_admin_write ON organizations
  FOR ALL TO authenticated
  USING (
    id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  );

-- Ensure read policy exists (idempotent).
DROP POLICY IF EXISTS org_user_read ON organizations;
CREATE POLICY org_user_read ON organizations
  FOR SELECT TO authenticated USING (id = current_user_org_id());
