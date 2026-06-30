-- Harden Row Level Security on audit and operational tables.
-- These tables should only be written to by service-role Edge Functions
-- and read by authorized users through explicit policies.

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- Drop any overly permissive default policies that may have been created earlier
-- and replace them with restrictive ones.
DROP POLICY IF EXISTS "Allow authenticated read" ON activity_logs;
DROP POLICY IF EXISTS "Allow all authenticated" ON login_attempts;

-- Service-role can do everything on these tables.
-- CREATE POLICY IF NOT EXISTS is not supported in Postgres 15 / Supabase CLI shadow DB,
-- so each policy is created conditionally.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Service role only on activity_logs'
  ) THEN
    CREATE POLICY "Service role only on activity_logs"
      ON activity_logs
      AS PERMISSIVE FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'platform_audit_logs' AND policyname = 'Service role only on platform_audit_logs'
  ) THEN
    CREATE POLICY "Service role only on platform_audit_logs"
      ON platform_audit_logs
      AS PERMISSIVE FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'login_attempts' AND policyname = 'Service role only on login_attempts'
  ) THEN
    CREATE POLICY "Service role only on login_attempts"
      ON login_attempts
      AS PERMISSIVE FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;

  -- Ensure authenticated users cannot read audit rows that do not belong to their org.
  -- (Existing organization-scoped policies in the application should remain more permissive.)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'activity_logs' AND policyname = 'Users read own org activity_logs'
  ) THEN
    CREATE POLICY "Users read own org activity_logs"
      ON activity_logs
      AS PERMISSIVE FOR SELECT
      TO authenticated
      USING (org_id IN (
        SELECT org_id FROM organization_memberships
        WHERE user_id = auth.uid() AND is_active = TRUE
      ));
  END IF;
END $$;
