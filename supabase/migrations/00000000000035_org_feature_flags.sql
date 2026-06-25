-- Organization feature flags for cashier, storefront, and API

-- 1. Add feature flags and storefront location to organizations
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS has_cashier_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_storefront_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_api_enabled BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS storefront_location_id UUID REFERENCES locations(id) ON DELETE SET NULL;

-- 2. Create API keys table for external integrations
CREATE TABLE IF NOT EXISTS organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Clé API',
  key_hash TEXT NOT NULL UNIQUE,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['read:stock', 'write:orders'],
  allowed_location_ids UUID[] DEFAULT NULL,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_organization_api_keys_org_id ON organization_api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_organization_api_keys_key_hash ON organization_api_keys(key_hash);

-- 3. Enable RLS on api_keys
ALTER TABLE organization_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_api_keys_org_select ON organization_api_keys;
CREATE POLICY organization_api_keys_org_select ON organization_api_keys
  FOR SELECT TO authenticated
  USING (org_id = current_user_org_id());

DROP POLICY IF EXISTS organization_api_keys_org_insert ON organization_api_keys;
CREATE POLICY organization_api_keys_org_insert ON organization_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS organization_api_keys_org_update ON organization_api_keys;
CREATE POLICY organization_api_keys_org_update ON organization_api_keys
  FOR UPDATE TO authenticated
  USING (org_id = current_user_org_id())
  WITH CHECK (org_id = current_user_org_id());

DROP POLICY IF EXISTS organization_api_keys_org_delete ON organization_api_keys;
CREATE POLICY organization_api_keys_org_delete ON organization_api_keys
  FOR DELETE TO authenticated
  USING (org_id = current_user_org_id());

-- 4. Helper to check if an organization has a specific feature enabled
CREATE OR REPLACE FUNCTION org_has_feature(p_org_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_feature = 'cashier' THEN
    RETURN EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND has_cashier_enabled = TRUE);
  ELSIF p_feature = 'storefront' THEN
    RETURN EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND has_storefront_enabled = TRUE);
  ELSIF p_feature = 'api' THEN
    RETURN EXISTS (SELECT 1 FROM organizations WHERE id = p_org_id AND has_api_enabled = TRUE);
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.org_has_feature(UUID, TEXT) SET search_path = pg_temp, pg_catalog;
REVOKE EXECUTE ON FUNCTION public.org_has_feature(UUID, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.org_has_feature(UUID, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.org_has_feature(UUID, TEXT) TO authenticated;

-- 5. Update cashier_sessions policies to require cashier feature
DROP POLICY IF EXISTS cashier_sessions_org_insert ON cashier_sessions;
CREATE POLICY cashier_sessions_org_insert ON cashier_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = current_user_org_id()
    AND operator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = org_id AND o.has_cashier_enabled = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'operator', 'cashier', 'super_admin')
    )
  );

DROP POLICY IF EXISTS cashier_sessions_org_select ON cashier_sessions;
CREATE POLICY cashier_sessions_org_select ON cashier_sessions
  FOR SELECT TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = org_id AND o.has_cashier_enabled = TRUE
    )
  );

DROP POLICY IF EXISTS cashier_sessions_org_update ON cashier_sessions;
CREATE POLICY cashier_sessions_org_update ON cashier_sessions
  FOR UPDATE TO authenticated
  USING (
    org_id = current_user_org_id()
    AND operator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM organizations o
      WHERE o.id = org_id AND o.has_cashier_enabled = TRUE
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND operator_id = auth.uid()
  );
