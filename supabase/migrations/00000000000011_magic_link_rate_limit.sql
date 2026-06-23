-- Auditability and brute-force protection for magic link requests.
CREATE TABLE IF NOT EXISTS magic_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_magic_link_requests_email_created
  ON magic_link_requests(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_magic_link_requests_ip_created
  ON magic_link_requests(ip_address, created_at DESC);

-- Convenience cleanup helper for old records.
CREATE OR REPLACE FUNCTION cleanup_old_magic_link_requests(p_older_than_days INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM magic_link_requests
  WHERE created_at < NOW() - (p_older_than_days || ' days')::INTERVAL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
