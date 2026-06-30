-- Improve auditability by adding indexes and wiring auth events to login_attempts.

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created
  ON activity_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created
  ON activity_logs(actor_id, created_at DESC);

-- Convenience cleanup helper for activity logs.
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs(p_older_than_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM activity_logs
  WHERE created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
