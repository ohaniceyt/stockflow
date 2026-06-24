-- 0. Helper: create a SQL slugify function for migration use only.
CREATE OR REPLACE FUNCTION _tmp_slugify(input TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      regexp_replace(
        regexp_replace(input, '[̀-ͯ]', '', 'g'),
        '[^a-z0-9]+', '-', 'gi'
      ),
      '(^-+|-+$)', '', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 1. Add slug column nullable initially so we can backfill existing rows.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug TEXT;

-- 2. Backfill slugs from existing organization names.
-- For empty/null slugs, derive from the org name; if the derived slug is empty, use a generic id-based fallback.
UPDATE organizations
SET slug = CASE
  WHEN COALESCE(_tmp_slugify(name), '') = '' THEN 'org-' || id::text
  ELSE _tmp_slugify(name)
END
WHERE slug IS NULL OR slug = '';

-- 3. Deduplicate slugs before applying the unique constraint.
-- Keep the oldest org for each slug; rename duplicates with a numeric suffix.
WITH ranked AS (
  SELECT
    id,
    slug,
    ROW_NUMBER() OVER (PARTITION BY slug ORDER BY created_at) AS rn
  FROM organizations
  WHERE slug IN (SELECT slug FROM organizations GROUP BY slug HAVING COUNT(*) > 1)
)
UPDATE organizations o
SET slug = r.slug || '-' || r.rn::text
FROM ranked r
WHERE o.id = r.id AND r.rn > 1;

-- 4. Ensure slug is NOT NULL and unique.
ALTER TABLE organizations ALTER COLUMN slug SET NOT NULL;
ALTER TABLE organizations ADD CONSTRAINT organizations_slug_unique UNIQUE (slug);

-- 4. Clean up temporary helper.
DROP FUNCTION IF EXISTS _tmp_slugify(TEXT);

-- 5. Update atomic onboarding RPC to accept and validate the organization slug.
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_org_name TEXT,
  p_org_slug TEXT,
  p_currency TEXT,
  p_timezone TEXT,
  p_default_location_name TEXT
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_membership_id UUID;
  v_normalized_slug TEXT;
BEGIN
  v_normalized_slug := lower(regexp_replace(regexp_replace(regexp_replace(p_org_slug, '[̀-ͯ]', '', 'g'), '[^a-z0-9]+', '-', 'gi'), '(^-+|-+$)', '', 'g'));

  IF v_normalized_slug IS NULL OR length(v_normalized_slug) < 2 OR length(v_normalized_slug) > 50 THEN
    RAISE EXCEPTION 'Invalid slug: must be 2–50 characters, lowercase letters, numbers and hyphens only';
  END IF;

  -- Create organization with the provided slug. The unique constraint will raise on conflict.
  INSERT INTO organizations (name, slug, currency, timezone, onboarding_completed)
  VALUES (p_org_name, v_normalized_slug, p_currency, p_timezone, TRUE)
  RETURNING id INTO v_org_id;

  -- Create super_admin membership.
  INSERT INTO organization_memberships (org_id, user_id, role, pin_hash, is_active, force_pin_change)
  VALUES (v_org_id, p_user_id, 'super_admin', NULL, TRUE, FALSE)
  RETURNING id INTO v_membership_id;

  -- Create free subscription.
  INSERT INTO subscriptions (org_id, plan_id, status, billing_interval, current_period_starts_at, current_period_ends_at)
  VALUES (
    v_org_id,
    'free',
    'active',
    'month',
    NOW(),
    NOW() + INTERVAL '100 years'
  );

  -- Create default location.
  INSERT INTO locations (org_id, name, description, is_default)
  VALUES (v_org_id, p_default_location_name, 'Emplacement par défaut créé lors de l’onboarding', TRUE);

  -- Activate org for user.
  UPDATE users SET active_org_id = v_org_id WHERE id = p_user_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
