-- Auditability and brute-force protection for PIN logins.
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  succeeded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_user_created
  ON login_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_created
  ON login_attempts(ip_address, created_at DESC);

-- Convenience cleanup helper for old records.
CREATE OR REPLACE FUNCTION cleanup_old_login_attempts(p_older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM login_attempts
  WHERE created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
