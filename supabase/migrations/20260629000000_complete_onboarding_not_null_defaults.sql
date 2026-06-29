-- Ensure complete_onboarding provides explicit defaults for NOT NULL columns.
-- Some columns became NOT NULL after the table was created (auto_reminder_days),
-- and relying on table defaults can be unreliable when SECURITY DEFINER sets a
-- restricted search_path. This recreates the function with explicit DEFAULT
-- values for all non-nullable boolean/integer organization columns.
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

  -- Create organization with explicit defaults for all NOT NULL columns.
  INSERT INTO public.organizations (
    name, slug, country, currency, timezone, onboarding_completed,
    has_cashier_enabled, has_storefront_enabled, has_api_enabled, has_invoicing_enabled, has_tax_enabled,
    auto_reminder_enabled, auto_reminder_days
  )
  VALUES (
    p_org_name, v_normalized_slug, v_country, v_currency, v_timezone, TRUE,
    FALSE, FALSE, FALSE, FALSE, FALSE,
    FALSE, 3
  )
  RETURNING id INTO v_org_id;

  -- Create super_admin membership.
  INSERT INTO public.organization_memberships (org_id, user_id, role, pin_hash, is_active, force_pin_change)
  VALUES (v_org_id, p_user_id, 'super_admin', NULL, TRUE, FALSE)
  RETURNING id INTO v_membership_id;

  -- Create subscription on the selected plan (default free).
  INSERT INTO public.subscriptions (org_id, plan_id, status, billing_interval, current_period_starts_at, current_period_ends_at)
  VALUES (
    v_org_id,
    v_plan_id,
    'active',
    'month',
    NOW(),
    NOW() + INTERVAL '100 years'
  );

  -- Create default location.
  INSERT INTO public.locations (org_id, name, description, is_default)
  VALUES (v_org_id, p_default_location_name, 'Emplacement par défaut créé lors de l’onboarding', TRUE);

  -- Activate org for user.
  UPDATE public.users SET active_org_id = v_org_id WHERE id = p_user_id;

  -- Mark the default location.
  UPDATE public.organizations
  SET storefront_location_id = (
    SELECT id FROM public.locations WHERE org_id = v_org_id AND is_default = TRUE LIMIT 1
  )
  WHERE id = v_org_id;

  RETURN v_org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Keep the hardened search path; table names are explicitly public-qualified.
ALTER FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = pg_temp, pg_catalog;
