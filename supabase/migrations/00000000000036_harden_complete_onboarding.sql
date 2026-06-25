-- Harden complete_onboarding RPC against caller impersonation.
-- The function is SECURITY DEFINER and previously accepted any p_user_id,
-- meaning a leaked service-role key or forged JWT could onboard arbitrary users.
-- This adds an auth.uid() assertion so the RPC can only complete onboarding
-- for the currently authenticated Supabase user.

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
  -- Security assertion: only the authenticated user may onboard themselves.
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: onboarding can only be completed by the authenticated user';
  END IF;

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

-- Also drop the old 5-argument variant that lacks the slug and the security assertion.
DROP FUNCTION IF EXISTS public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT);

-- Ensure deterministic search path remains intact.
ALTER FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public, pg_catalog;
