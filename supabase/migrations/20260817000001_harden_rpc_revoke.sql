-- Lot A — Lock down backend-only / cross-tenant / internal RPCs.
--
-- These functions must NOT be callable by `anon`/`authenticated` directly via
-- PostgREST, because either:
--   (a) they take an `org_id` argument and perform no membership check, so a
--       direct authenticated call could act on / read any tenant
--       (record_storefront_order, record_invoice_payment, convert_quote_to_invoice,
--        upsert_org_pending_operation, movements_count_this_month);
--   (b) they are cleanup helpers meant for cron / service_role only
--       (cleanup_old_*, cleanup_rate_limit_requests);
--   (c) they are log writers — a direct authenticated call would allow
--       forging audit entries (log_platform_action, log_org_activity).
--
-- Their legitimate callers are:
--   - edge functions using the service_role key
--     (record_storefront_order, upsert_org_pending_operation,
--      movements_count_this_month, cleanup_old_audit_logs via cleanup-audit-logs);
--   - the SECURITY DEFINER trigger `audit_trigger_func` for log_org_activity
--     (owned by postgres, which bypasses EXECUTE grants).
-- record_invoice_payment / convert_quote_to_invoice / log_platform_action
-- currently have no caller at all.
--
-- IMPORTANT: `CREATE FUNCTION` grants EXECUTE TO PUBLIC by default, so a bare
-- `REVOKE FROM anon, authenticated` is ineffective — those roles keep access
-- via PUBLIC. The correct hardening is REVOKE FROM PUBLIC then re-grant only to
-- `service_role` (the role edge functions connect as). postgres (superuser) and
-- SECURITY DEFINER trigger owners bypass grants entirely, so audit triggers and
-- superuser maintenance keep working.
--
-- The DO block resolves each function's identity signature from pg_proc so we
-- do not have to hardcode argument types (robust to overloads), and asserts we
-- touched exactly the 12 expected functions so a rename/typo cannot silently
-- skip a target.

DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'record_storefront_order',
        'record_invoice_payment',
        'convert_quote_to_invoice',
        'upsert_org_pending_operation',
        'cleanup_old_audit_logs',
        'cleanup_old_activity_logs',
        'cleanup_old_login_attempts',
        'cleanup_old_magic_link_requests',
        'cleanup_rate_limit_requests',
        'log_platform_action',
        'log_org_activity',
        'movements_count_this_month'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', r.sig);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    n := n + 1;
  END LOOP;

  IF n <> 12 THEN
    RAISE EXCEPTION 'harden_rpc_revoke: expected 12 functions, found %', n;
  END IF;
END $$;