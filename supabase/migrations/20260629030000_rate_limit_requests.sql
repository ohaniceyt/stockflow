-- Shared rate-limit table used by Edge Functions to enforce IP/email windows.
CREATE TABLE IF NOT EXISTS rate_limit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ip', 'email')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_requests_key_type_created
  ON rate_limit_requests(key, type, created_at);

-- Enable RLS and lock the table down: only service-role can write.
ALTER TABLE rate_limit_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'rate_limit_requests' AND policyname = 'Service role only'
  ) THEN
    CREATE POLICY "Service role only" ON rate_limit_requests
      AS PERMISSIVE FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Clean old rows automatically after 24 hours.
CREATE OR REPLACE FUNCTION cleanup_rate_limit_requests()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_requests WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
