-- Fix complete_onboarding search_path so RLS policies can resolve is_platform_admin().
--
-- The previous hardening migrations set complete_onboarding's search_path to
-- pg_temp, pg_catalog. That broke onboarding because the INSERT/UPDATE statements
-- inside the function trigger RLS policies on organizations, memberships,
-- subscriptions, locations and users, and those policies call unqualified helper
-- functions such as is_platform_admin(). With search_path excluding "public",
-- Postgres raises: function is_platform_admin() does not exist.
--
-- We keep the search_path restrictive but add "public" so policies and explicitly
-- qualified table references both work.

ALTER FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) SET search_path = public, pg_catalog;
