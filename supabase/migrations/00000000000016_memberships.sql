-- Membership refactor: split users into a global profile (auth uid) and per-org memberships.
-- Enables one auth account to belong to multiple organizations.

-- 1. Create the membership table
CREATE TABLE organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'operator', 'reader')),
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  force_pin_change BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX idx_organization_memberships_org ON organization_memberships(org_id);
CREATE INDEX idx_organization_memberships_user ON organization_memberships(user_id);
CREATE INDEX idx_organization_memberships_active ON organization_memberships(user_id, org_id) WHERE is_active = TRUE;

CREATE TRIGGER update_organization_memberships_updated_at BEFORE UPDATE ON organization_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Backfill memberships from existing users
INSERT INTO organization_memberships (org_id, user_id, role, pin_hash, is_active, force_pin_change, last_login_at, created_at, updated_at)
SELECT org_id, id, role, pin_hash, is_active, force_pin_change, last_login_at, created_at, updated_at
FROM users;

-- 3. Add active_org_id to users and initialize it with the existing org
ALTER TABLE users ADD COLUMN active_org_id UUID REFERENCES organizations(id) ON DELETE SET NULL;
UPDATE users SET active_org_id = org_id;

-- 4. Change invitations.invited_by to reference the membership instead of the user profile
ALTER TABLE invitations ADD COLUMN invited_by_membership_id UUID REFERENCES organization_memberships(id) ON DELETE SET NULL;
UPDATE invitations i
SET invited_by_membership_id = m.id
FROM organization_memberships m
WHERE m.user_id = i.invited_by
  AND m.org_id = i.org_id;

ALTER TABLE invitations DROP COLUMN invited_by;
ALTER TABLE invitations RENAME COLUMN invited_by_membership_id TO invited_by;
ALTER TABLE invitations ALTER COLUMN invited_by SET NOT NULL;

-- 5. Remove org-specific columns from users (now stored on memberships)
-- Drop policies that depend on users.org_id before removing the column.
DROP POLICY IF EXISTS users_org_read ON users;
DROP POLICY IF EXISTS users_org_admin_manage ON users;
DROP POLICY IF EXISTS invitations_org_manage ON invitations;
DROP INDEX IF EXISTS idx_users_org_email;
DROP INDEX IF EXISTS idx_users_org;
DROP INDEX IF EXISTS idx_users_role;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_org_email_unique;
ALTER TABLE users DROP COLUMN org_id;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN pin_hash;
ALTER TABLE users DROP COLUMN is_active;
ALTER TABLE users DROP COLUMN force_pin_change;
ALTER TABLE users DROP COLUMN last_login_at;

-- 6. Restore global unique email on the user profile
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);

-- 7. Update helper functions
CREATE OR REPLACE FUNCTION current_user_org_id()
RETURNS UUID AS $$
BEGIN
  RETURN (SELECT active_org_id FROM users WHERE id = auth.uid() LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_membership()
RETURNS TABLE (
  id UUID,
  org_id UUID,
  user_id UUID,
  role TEXT,
  pin_hash TEXT,
  is_active BOOLEAN,
  force_pin_change BOOLEAN,
  last_login_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.org_id, m.user_id, m.role, m.pin_hash, m.is_active, m.force_pin_change, m.last_login_at
  FROM organization_memberships m
  JOIN users u ON u.id = m.user_id
  WHERE u.id = auth.uid()
    AND u.active_org_id = m.org_id
    AND m.is_active = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM current_membership() cm WHERE cm.role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Update RLS policies

-- Users (global profile)
DROP POLICY IF EXISTS users_super_admin_all ON users;
DROP POLICY IF EXISTS users_org_read ON users;
DROP POLICY IF EXISTS users_org_admin_manage ON users;
DROP POLICY IF EXISTS users_platform_read ON users;

CREATE POLICY users_platform_read ON users
  FOR SELECT TO authenticated USING (is_platform_admin());

CREATE POLICY users_self_read ON users
  FOR SELECT TO authenticated USING (id = auth.uid());

CREATE POLICY users_org_read ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = users.id
        AND m.org_id = current_user_org_id()
        AND m.is_active = TRUE
    )
  );

CREATE POLICY users_org_admin_manage ON users
  FOR ALL TO authenticated
  USING (
    id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM current_membership() cm
        WHERE cm.role IN ('super_admin', 'admin')
      )
      AND EXISTS (
        SELECT 1 FROM organization_memberships m
        WHERE m.user_id = users.id
          AND m.org_id = current_user_org_id()
          AND m.is_active = TRUE
      )
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  );

-- Organization memberships
ALTER TABLE organization_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_memberships_self_read ON organization_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_platform_admin());

CREATE POLICY organization_memberships_org_admin ON organization_memberships
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  );

-- Invitations
DROP POLICY IF EXISTS invitations_recipient_read ON invitations;
DROP POLICY IF EXISTS invitations_org_manage ON invitations;

CREATE POLICY invitations_recipient_read ON invitations
  FOR SELECT TO authenticated
  USING (email = auth.email());

CREATE POLICY invitations_org_manage ON invitations
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('super_admin', 'admin')
    )
  );

-- Tenant tables: replace role checks that referenced users.role with current_membership role
DROP POLICY IF EXISTS products_org_admin_write ON products;
CREATE POLICY products_org_admin_write ON products
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (org_id = current_user_org_id());

DROP POLICY IF EXISTS activity_logs_org_admin ON activity_logs;
CREATE POLICY activity_logs_org_admin ON activity_logs
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (org_id = current_user_org_id());

DROP POLICY IF EXISTS movements_org_write ON movements;
CREATE POLICY movements_org_write ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'operator', 'super_admin')
    )
    AND operator_id = auth.uid()
  );

-- Organizations: ensure the read policy still works with current_user_org_id()
DROP POLICY IF EXISTS org_user_read ON organizations;
CREATE POLICY org_user_read ON organizations
  FOR SELECT TO authenticated USING (id = current_user_org_id());
