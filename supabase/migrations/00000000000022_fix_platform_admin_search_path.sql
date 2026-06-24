-- Fix search_path for platform admin helpers so they resolve public tables
-- after migration 19 restricted their search_path to pg_temp, pg_catalog.

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins WHERE auth_user_id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.platform_admins WHERE auth_user_id = p_user_id AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.platform_admin_role(p_user_id UUID)
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT role FROM public.platform_admins
    WHERE auth_user_id = p_user_id AND is_active = TRUE
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.log_platform_action(
  p_actor_id UUID,
  p_actor_role TEXT,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_metadata JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.platform_audit_logs (actor_id, actor_role, action, target_type, target_id, metadata)
  VALUES (p_actor_id, p_actor_role, p_action, p_target_type, p_target_id, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply immutable search_path
ALTER FUNCTION public.is_platform_admin() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.is_platform_admin(UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.platform_admin_role(UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.log_platform_action(UUID, TEXT, TEXT, TEXT, UUID, JSONB) SET search_path = pg_temp, pg_catalog;
