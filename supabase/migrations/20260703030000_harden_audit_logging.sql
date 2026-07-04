-- Harden audit logging after the audit-logging audit.
-- Goals:
--   1. Make audit tables tamper-evident for authenticated users (service role still writes).
--   2. Provide a retention cleanup function for activity_logs and platform_audit_logs.

-- 1. activity_logs: explicit deny for all authenticated writes.
DROP POLICY IF EXISTS activity_logs_no_write ON activity_logs;

CREATE POLICY activity_logs_no_write ON activity_logs
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 2. platform_audit_logs: explicit deny for all authenticated writes.
DROP POLICY IF EXISTS platform_audit_logs_no_write ON platform_audit_logs;

CREATE POLICY platform_audit_logs_no_write ON platform_audit_logs
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 3. login_attempts: explicit deny for all authenticated writes.
DROP POLICY IF EXISTS login_attempts_no_write ON login_attempts;

CREATE POLICY login_attempts_no_write ON login_attempts
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 4. magic_link_requests: explicit deny for all authenticated writes.
DROP POLICY IF EXISTS magic_link_requests_no_write ON magic_link_requests;

CREATE POLICY magic_link_requests_no_write ON magic_link_requests
  FOR ALL TO authenticated
  USING (false)
  WITH CHECK (false);

-- 5. Retention cleanup helper for audit tables.
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(p_older_than_days INTEGER DEFAULT 90)
RETURNS TABLE (deleted_activity_logs BIGINT, deleted_platform_audit_logs BIGINT) AS $$
DECLARE
  v_deleted_activity BIGINT;
  v_deleted_platform BIGINT;
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted_activity = ROW_COUNT;

  DELETE FROM platform_audit_logs
  WHERE created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted_platform = ROW_COUNT;

  RETURN QUERY SELECT v_deleted_activity, v_deleted_platform;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
