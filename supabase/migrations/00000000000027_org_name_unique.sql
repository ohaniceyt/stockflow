-- 0. Deduplicate existing organization names before adding the unique constraint.
-- Keep the oldest org for each name; rename duplicates with a unique numeric suffix.
WITH ranked AS (
  SELECT
    id,
    name,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at) AS rn
  FROM organizations
  WHERE name IN (SELECT name FROM organizations GROUP BY name HAVING COUNT(*) > 1)
)
UPDATE organizations o
SET name = r.name || ' (' || r.rn::text || ')'
FROM ranked r
WHERE o.id = r.id AND r.rn > 1;

-- 1. Ensure organization names are unique system-wide to avoid ambiguity in support/back-office.
ALTER TABLE organizations ADD CONSTRAINT organizations_name_unique UNIQUE (name);

-- 2. Atomic onboarding RPC: creates org, membership, subscription and default location in one transaction.
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_org_name TEXT,
  p_currency TEXT,
  p_timezone TEXT,
  p_default_location_name TEXT
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_membership_id UUID;
BEGIN
  -- Create organization.
  INSERT INTO organizations (name, currency, timezone, onboarding_completed)
  VALUES (p_org_name, p_currency, p_timezone, TRUE)
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
