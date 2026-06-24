-- BackOffice foundation: platform admin roles and cross-platform audit logs.

-- 1. Add role column to platform_admins
ALTER TABLE platform_admins
  ADD COLUMN role TEXT NOT NULL DEFAULT 'moderator'
  CHECK (role IN ('super_admin', 'moderator'));

-- 2. Seed existing platform admins as super_admin
UPDATE platform_admins SET role = 'super_admin' WHERE role IS NULL;

-- 3. Cross-platform audit log
CREATE TABLE platform_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_role TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_actor ON platform_audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_platform_audit_target ON platform_audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX idx_platform_audit_action ON platform_audit_logs(action, created_at DESC);
CREATE INDEX idx_platform_audit_created ON platform_audit_logs(created_at DESC);

-- 4. RLS
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_audit_logs_admin_read ON platform_audit_logs
  FOR SELECT TO authenticated USING (is_platform_admin());

-- 5. Helper: platform admin role
CREATE OR REPLACE FUNCTION platform_admin_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM platform_admins
    WHERE auth_user_id = p_user_id AND is_active = TRUE
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Ensure platform admins can read tenant activity logs
DROP POLICY IF EXISTS activity_logs_org_admin ON activity_logs;
CREATE POLICY activity_logs_org_admin ON activity_logs
  FOR SELECT TO authenticated
  USING (org_id = current_user_org_id() OR is_platform_admin());

-- 7. Ensure platform admins can read rate-limit audit tables
DROP POLICY IF EXISTS login_attempts_platform_read ON login_attempts;
CREATE POLICY login_attempts_platform_read ON login_attempts
  FOR SELECT TO authenticated USING (is_platform_admin());

DROP POLICY IF EXISTS magic_link_requests_platform_read ON magic_link_requests;
CREATE POLICY magic_link_requests_platform_read ON magic_link_requests
  FOR SELECT TO authenticated USING (is_platform_admin());

-- 8. Log function for platform audit
CREATE OR REPLACE FUNCTION log_platform_action(
  p_actor_id UUID,
  p_actor_role TEXT,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO platform_audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (p_actor_id, p_actor_role, p_action, p_target_type, p_target_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Fix search_path for new functions
ALTER FUNCTION platform_admin_role(UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION log_platform_action(UUID, TEXT, TEXT, TEXT, UUID, JSONB) SET search_path = pg_temp, pg_catalog;

-- 10. Seed the default platform admin as super_admin if it exists
UPDATE platform_admins
SET role = 'super_admin'
WHERE auth_user_id = (
  SELECT id FROM users WHERE email = 'earful-wannabe-wok@duck.com' LIMIT 1
);
