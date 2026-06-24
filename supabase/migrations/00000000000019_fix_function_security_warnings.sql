-- Fix Supabase database-linter warnings about mutable search_path and
-- exposed SECURITY DEFINER helper functions.

-- 1. Set an immutable search_path on every custom function so unqualified names
-- cannot be hijacked by a malicious public schema object.
ALTER FUNCTION public.update_updated_at_column() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.ensure_default_location() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.is_super_admin() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_user_org_id() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.create_default_stock_level() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.apply_inventory_session(UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_user_role() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_user_is_admin_or_super_admin() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_user_is_operator_or_above() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.cleanup_old_login_attempts(INTEGER) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.cleanup_old_magic_link_requests(INTEGER) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.set_default_location(UUID, UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_membership() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.is_platform_admin() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.is_platform_admin(UUID) SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.current_org_plan_id() SET search_path = pg_temp, pg_catalog;
ALTER FUNCTION public.movements_count_this_month(UUID) SET search_path = pg_temp, pg_catalog;

-- 2. Prevent anonymous users from executing any custom function via PostgREST.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_default_location() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_default_stock_level() FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_inventory_session(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin_or_super_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_is_operator_or_above() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_magic_link_requests(INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_default_location(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_membership() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_org_plan_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.movements_count_this_month(UUID) FROM anon;

-- 3. Prevent signed-in users from calling internal helper functions directly.
-- The only function intentionally exposed to authenticated clients is
-- apply_inventory_session, which the frontend calls via supabase.rpc.
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_default_location() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_org_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_default_stock_level() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_admin_or_super_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_is_operator_or_above() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_login_attempts(INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_magic_link_requests(INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.set_default_location(UUID, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_membership() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.current_org_plan_id() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.movements_count_this_month(UUID) FROM authenticated;
