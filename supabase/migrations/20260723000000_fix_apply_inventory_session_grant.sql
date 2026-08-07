-- Migration 00000000000024 revoked EXECUTE on apply_inventory_session(UUID) from authenticated
-- to satisfy the security linter, but it never re-granted it. As a result, the frontend
-- supabase.rpc('apply_inventory_session') call fails with a permission-denied error,
-- making it impossible to validate/apply an inventory session from the UI.

GRANT EXECUTE ON FUNCTION public.apply_inventory_session(UUID) TO authenticated;
