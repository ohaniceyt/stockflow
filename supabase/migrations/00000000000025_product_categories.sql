-- Product categories: reusable categories per organization.
-- Keeps products.category as a free-text display field for backward compatibility.

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, name)
);

CREATE INDEX IF NOT EXISTS idx_categories_org ON categories(org_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categories_select ON categories;
CREATE POLICY categories_select ON categories
  FOR SELECT TO authenticated
  USING (
    org_id = current_user_org_id()
    OR is_platform_admin()
  );

DROP POLICY IF EXISTS categories_manage ON categories;
CREATE POLICY categories_manage ON categories
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
