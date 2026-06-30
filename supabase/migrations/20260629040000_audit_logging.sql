-- Improve auditability by adding indexes and wiring auth events to login_attempts.

CREATE INDEX IF NOT EXISTS idx_activity_logs_org_created
  ON activity_logs(org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_created
  ON activity_logs(actor_id, created_at DESC);

-- Log successful Supabase Auth sign-ins to login_attempts.
-- IP address is not available inside the database trigger; keep the timestamp
-- and user_id for anomaly detection.
CREATE OR REPLACE FUNCTION auth.log_auth_sign_in()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at THEN
    INSERT INTO public.login_attempts (ip_address, user_id, succeeded)
    VALUES (NULL, NEW.id, TRUE);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_sign_in ON auth.users;
CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth.log_auth_sign_in();

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
