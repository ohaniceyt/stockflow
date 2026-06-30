-- Fix Supabase database-linter warnings about mutable search_path and
-- exposed SECURITY DEFINER helper functions.
--
-- Wrapped in a DO block so this migration can be replayed on a clean shadow DB
-- even if some functions referenced here were later dropped by subsequent
-- migrations (e.g. set_default_location is recreated in a later migration).

DO $$
DECLARE
  fn record;
BEGIN
  -- 1. Set an immutable search_path on every custom function so unqualified names
  -- cannot be hijacked by a malicious public schema object.
  FOR fn IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at_column',
        'ensure_default_location',
        'is_super_admin',
        'current_user_org_id',
        'create_default_stock_level',
        'record_movement',
        'apply_inventory_session',
        'current_user_role',
        'current_user_is_admin_or_super_admin',
        'current_user_is_operator_or_above',
        'cleanup_old_login_attempts',
        'cleanup_old_magic_link_requests',
        'set_default_location',
        'current_membership',
        'is_platform_admin',
        'current_org_plan_id',
        'movements_count_this_month'
      )
  LOOP
    BEGIN
      EXECUTE format('ALTER FUNCTION public.%I SET search_path = pg_temp, pg_catalog', fn.signature);
    EXCEPTION WHEN undefined_function THEN
      -- Function may not exist at this point in a fresh replay; skip it.
      RAISE NOTICE 'Skipping missing function: %', fn.signature;
    END;
  END LOOP;
END $$;

-- 2. Prevent anonymous users from executing any custom function via PostgREST.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at_column',
        'ensure_default_location',
        'is_super_admin',
        'current_user_org_id',
        'create_default_stock_level',
        'record_movement',
        'apply_inventory_session',
        'current_user_role',
        'current_user_is_admin_or_super_admin',
        'current_user_is_operator_or_above',
        'cleanup_old_login_attempts',
        'cleanup_old_magic_link_requests',
        'set_default_location',
        'current_membership',
        'is_platform_admin',
        'current_org_plan_id',
        'movements_count_this_month'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM anon', fn.signature);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Skipping missing function: %', fn.signature;
    END;
  END LOOP;
END $$;

-- 3. Prevent signed-in users from calling internal helper functions directly.
-- The only function intentionally exposed to authenticated clients is
-- apply_inventory_session, which the frontend calls via supabase.rpc.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'update_updated_at_column',
        'ensure_default_location',
        'is_super_admin',
        'current_user_org_id',
        'create_default_stock_level',
        'record_movement',
        'current_user_role',
        'current_user_is_admin_or_super_admin',
        'current_user_is_operator_or_above',
        'cleanup_old_login_attempts',
        'cleanup_old_magic_link_requests',
        'set_default_location',
        'current_membership',
        'is_platform_admin',
        'current_org_plan_id',
        'movements_count_this_month'
      )
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I FROM authenticated', fn.signature);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'Skipping missing function: %', fn.signature;
    END;
  END LOOP;
END $$;
