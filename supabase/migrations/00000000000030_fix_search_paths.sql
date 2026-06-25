-- Fix search_path for helper functions that reference application tables.
-- Migration 00000000000019 set these to pg_temp, pg_catalog to satisfy the
-- Supabase security linter, but that caused unqualified table references
-- (e.g. "locations") to fail with 42P01 inside SECURITY DEFINER functions and
-- triggers during onboarding and normal operation. Restoring an explicit
-- search_path of public, pg_catalog keeps table resolution deterministic
-- while still avoiding search-path hijacking.

ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_catalog;
ALTER FUNCTION public.ensure_default_location() SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_default_stock_level() SET search_path = public, pg_catalog;
ALTER FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT) SET search_path = public, pg_catalog;
ALTER FUNCTION public.record_movement(UUID, UUID, UUID, TEXT, INTEGER, TEXT, UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.apply_inventory_session(UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_default_location(UUID, UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_user_role() SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_user_is_admin_or_super_admin() SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_user_is_operator_or_above() SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_membership() SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_user_org_id() SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_super_admin() SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_platform_admin() SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_platform_admin(UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.platform_admin_role(UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.log_platform_action(UUID, TEXT, TEXT, TEXT, UUID, JSONB) SET search_path = public, pg_catalog;
ALTER FUNCTION public.current_org_plan_id() SET search_path = public, pg_catalog;
ALTER FUNCTION public.movements_count_this_month(UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_old_login_attempts(INTEGER) SET search_path = public, pg_catalog;
ALTER FUNCTION public.cleanup_old_magic_link_requests(INTEGER) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_contacts_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT) SET search_path = public, pg_catalog;
ALTER FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public, pg_catalog;
ALTER FUNCTION public.create_inventory_session(UUID, UUID, TEXT, UUID) SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_inventory_count(UUID, INTEGER) SET search_path = public, pg_catalog;
