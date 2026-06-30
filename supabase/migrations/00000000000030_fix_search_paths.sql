-- Fix search_path for helper functions that reference application tables.
-- Migration 00000000000019 set these to pg_temp, pg_catalog to satisfy the
-- Supabase security linter, but that caused unqualified table references
-- (e.g. "locations") to fail with 42P01 inside SECURITY DEFINER functions and
-- triggers during onboarding and normal operation. Restoring an explicit
-- search_path of public, pg_catalog keeps table resolution deterministic
-- while still avoiding search-path hijacking.
--
-- Wrapped in a DO block so missing functions are skipped when the migration is
-- replayed on a fresh shadow DB (some functions are dropped/renamed by later
-- migrations).

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT
      p.proname AS name,
      pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at_column',
        'ensure_default_location',
        'create_default_stock_level',
        'record_movement',
        'apply_inventory_session',
        'set_default_location',
        'current_user_role',
        'current_user_is_admin_or_super_admin',
        'current_user_is_operator_or_above',
        'current_membership',
        'current_user_org_id',
        'is_super_admin',
        'is_platform_admin',
        'platform_admin_role',
        'log_platform_action',
        'current_org_plan_id',
        'movements_count_this_month',
        'cleanup_old_login_attempts',
        'cleanup_old_magic_link_requests',
        'update_contacts_updated_at',
        'complete_onboarding',
        'create_inventory_session',
        'update_inventory_count'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public, pg_catalog', fn.name, fn.args);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Skipping missing function: %(%s)', fn.name, fn.args;
    END;
  END LOOP;
END $$;
