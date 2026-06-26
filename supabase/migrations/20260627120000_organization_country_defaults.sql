-- Ajout du pays de l'organisation et mapping pays -> devise/fuseau horaire par défaut.

-- 1. Add country column to organizations.
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS country TEXT;

-- 2. Reference table for country defaults (currency + timezone).
-- This is useful for onboarding, future invoicing compliance and platform analytics.
CREATE TABLE IF NOT EXISTS public.country_defaults (
  country_code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  currency TEXT NOT NULL,
  timezone TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Seed francophone African and common defaults.
INSERT INTO public.country_defaults (country_code, name, currency, timezone)
VALUES
  ('BJ', 'Bénin', 'XOF', 'Africa/Abidjan'),
  ('BF', 'Burkina Faso', 'XOF', 'Africa/Abidjan'),
  ('CM', 'Cameroun', 'XAF', 'Africa/Lagos'),
  ('CF', 'Centrafrique', 'XAF', 'Africa/Lagos'),
  ('TD', 'Tchad', 'XAF', 'Africa/Lagos'),
  ('KM', 'Comores', 'KMF', 'Africa/Nairobi'),
  ('CG', 'Congo', 'XAF', 'Africa/Lagos'),
  ('CD', 'Congo, République démocratique', 'CDF', 'Africa/Kinshasa'),
  ('CI', 'Côte d''Ivoire', 'XOF', 'Africa/Abidjan'),
  ('DJ', 'Djibouti', 'DJF', 'Africa/Nairobi'),
  ('GA', 'Gabon', 'XAF', 'Africa/Lagos'),
  ('GN', 'Guinée', 'GNF', 'Africa/Abidjan'),
  ('GW', 'Guinée-Bissau', 'XOF', 'Africa/Abidjan'),
  ('MG', 'Madagascar', 'MGA', 'Africa/Nairobi'),
  ('ML', 'Mali', 'XOF', 'Africa/Abidjan'),
  ('MR', 'Mauritanie', 'MRU', 'Africa/Abidjan'),
  ('NE', 'Niger', 'XOF', 'Africa/Abidjan'),
  ('RW', 'Rwanda', 'RWF', 'Africa/Kigali'),
  ('SN', 'Sénégal', 'XOF', 'Africa/Abidjan'),
  ('SC', 'Seychelles', 'SCR', 'Africa/Nairobi'),
  ('TG', 'Togo', 'XOF', 'Africa/Abidjan'),
  ('TN', 'Tunisie', 'TND', 'Africa/Tunis'),
  -- Additional common choices
  ('FR', 'France', 'EUR', 'Europe/Paris'),
  ('BE', 'Belgique', 'EUR', 'Europe/Brussels'),
  ('CA', 'Canada', 'CAD', 'America/Toronto'),
  ('CH', 'Suisse', 'CHF', 'Europe/Zurich'),
  ('GB', 'Royaume-Uni', 'GBP', 'Europe/London'),
  ('US', 'États-Unis', 'USD', 'America/New_York')
ON CONFLICT (country_code) DO UPDATE SET
  name = EXCLUDED.name,
  currency = EXCLUDED.currency,
  timezone = EXCLUDED.timezone;

-- 4. Enable RLS on country_defaults and allow any authenticated user to read it.
ALTER TABLE public.country_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY country_defaults_public_read
  ON public.country_defaults
  FOR SELECT TO authenticated
  USING (is_active = TRUE);

-- 5. Update complete_onboarding RPC to accept country and fall back to defaults when missing.
CREATE OR REPLACE FUNCTION complete_onboarding(
  p_user_id UUID,
  p_org_name TEXT,
  p_org_slug TEXT,
  p_country TEXT,
  p_currency TEXT,
  p_timezone TEXT,
  p_default_location_name TEXT,
  p_plan_id TEXT DEFAULT 'free'
)
RETURNS UUID AS $$
DECLARE
  v_org_id UUID;
  v_membership_id UUID;
  v_normalized_slug TEXT;
  v_plan_id TEXT;
  v_country TEXT;
  v_currency TEXT;
  v_timezone TEXT;
BEGIN
  -- Security assertion: only the authenticated user may onboard themselves.
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: onboarding can only be completed by the authenticated user';
  END IF;

  v_normalized_slug := lower(regexp_replace(regexp_replace(regexp_replace(p_org_slug, '[̀-ͯ]', '', 'g'), '[^a-z0-9]+', '-', 'gi'), '(^-+|-+$)', '', 'g'));

  IF v_normalized_slug IS NULL OR length(v_normalized_slug) < 2 OR length(v_normalized_slug) > 50 THEN
    RAISE EXCEPTION 'Invalid slug: must be 2–50 characters, lowercase letters, numbers and hyphens only';
  END IF;

  v_plan_id := COALESCE(p_plan_id, 'free');
  IF v_plan_id NOT IN ('free', 'starter', 'pro') THEN
    RAISE EXCEPTION 'Invalid plan: must be free, starter or pro';
  END IF;

  -- Resolve country defaults if currency/timezone are not provided.
  v_country := NULLIF(trim(p_country), '');
  IF v_country IS NOT NULL THEN
    SELECT currency, timezone INTO v_currency, v_timezone
    FROM public.country_defaults
    WHERE country_code = v_country;
  END IF;
  v_currency := COALESCE(NULLIF(trim(p_currency), ''), v_currency, 'XOF');
  v_timezone := COALESCE(NULLIF(trim(p_timezone), ''), v_timezone, 'Africa/Abidjan');

  -- Create organization.
  INSERT INTO organizations (name, slug, country, currency, timezone, onboarding_completed)
  VALUES (p_org_name, v_normalized_slug, v_country, v_currency, v_timezone, TRUE)
  RETURNING id INTO v_org_id;

  -- Create super_admin membership.
  INSERT INTO organization_memberships (org_id, user_id, role, pin_hash, is_active, force_pin_change)
  VALUES (v_org_id, p_user_id, 'super_admin', NULL, TRUE, FALSE)
  RETURNING id INTO v_membership_id;

  -- Create subscription on the selected plan (default free).
  INSERT INTO subscriptions (org_id, plan_id, status, billing_interval, current_period_starts_at, current_period_ends_at)
  VALUES (
    v_org_id,
    v_plan_id,
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

  -- Mark the default location.
  UPDATE organizations
  SET storefront_location_id = (
    SELECT id FROM locations WHERE org_id = v_org_id AND is_default = TRUE LIMIT 1
  )
  WHERE id = v_org_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop old 6-argument variant without country.
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- Ensure deterministic search path remains intact.
ALTER FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = pg_temp, pg_catalog;
