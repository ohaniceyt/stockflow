-- Lot D — Database hardening.
--
-- 1. search_path injection guard: remove `pg_temp` from every SECURITY DEFINER
--    function in `public`. `pg_temp` is writable by every role (including
--    anon/authenticated), so a SECURITY DEFINER function with pg_temp in its
--    search_path can be hijacked by shadowing an unqualified name with a temp
--    object. No function in the codebase uses temp tables (verified), so
--    dropping pg_temp is safe; the project's own recent SECURITY DEFINER
--    functions already use `public, pg_catalog`. `ALTER FUNCTION ... SET
--    search_path` is metadata-only and always succeeds; the body is unchanged.
--
-- 2. FK movements.cashier_session_id -> cashier_sessions(id). The column
--    existed (00000000000033) with only an index; orphaned movement rows
--    (session deleted before the FK existed) are tolerated via NOT VALID, so
--    existing data is not re-scanned and the migration cannot fail on
--    historical dangling references. Future writes are constrained.
--
-- 3. Defense-in-depth CHECK constraints: products.cost_price / selling_price
--    >= 0 and movements.unit_price NULL-or->= 0. Added NOT VALID so existing
--    rows are not re-scanned (cannot fail the deploy); new writes are checked.
--
-- 4. payments RLS: split the single FOR ALL policy into a member-wide SELECT
--    and an admin-only write. No code path writes `payments` via authenticated
--    RLS today (the table is populated only via service_role / triggers, which
--    bypass RLS), so restricting the write policy to org admins cannot break a
--    live flow; it closes the hole where any org member (incl. reader) could
--    insert/update/delete payment rows.

-- =============================================================================
-- 1. search_path: public, pg_catalog on all SECURITY DEFINER functions.
-- =============================================================================
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT format('%I.%I(%s)', n.nspname, p.proname,
                  pg_get_function_identity_arguments(p.oid)) AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_catalog', r.sig);
  END LOOP;
END $$;

-- =============================================================================
-- 2. FK movements.cashier_session_id -> cashier_sessions(id).
--    NOT VALID: do not scan/verify existing rows (avoids deploy failure on
--    historical orphans). New writes are enforced.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.movements'::regclass
      AND conname = 'movements_cashier_session_fk'
  ) THEN
    ALTER TABLE public.movements
      ADD CONSTRAINT movements_cashier_session_fk
      FOREIGN KEY (cashier_session_id)
      REFERENCES public.cashier_sessions(id)
      ON DELETE SET NULL
      NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- 3. Non-negative price CHECKs (products + movements.unit_price).
--    NOT VALID: existing rows not re-scanned; new writes enforced.
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_cost_price_nonneg'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_cost_price_nonneg CHECK (cost_price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.products'::regclass
      AND conname = 'products_selling_price_nonneg'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_selling_price_nonneg CHECK (selling_price >= 0) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.movements'::regclass
      AND conname = 'movements_unit_price_nonneg'
  ) THEN
    ALTER TABLE public.movements
      ADD CONSTRAINT movements_unit_price_nonneg
      CHECK (unit_price IS NULL OR unit_price >= 0) NOT VALID;
  END IF;
END $$;

-- =============================================================================
-- 4. payments RLS: member-wide SELECT, admin-only write.
-- =============================================================================
DROP POLICY IF EXISTS org_isolation_payments ON public.payments;

CREATE POLICY payments_org_select ON public.payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN organization_memberships m ON m.org_id = i.org_id
      WHERE i.id = payments.invoice_id
        AND m.user_id = auth.uid()
        AND m.is_active = TRUE
    )
  );

CREATE POLICY payments_admin_write ON public.payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN organization_memberships m ON m.org_id = i.org_id
      WHERE i.id = payments.invoice_id
        AND m.user_id = auth.uid()
        AND m.is_active = TRUE
        AND m.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN organization_memberships m ON m.org_id = i.org_id
      WHERE i.id = payments.invoice_id
        AND m.user_id = auth.uid()
        AND m.is_active = TRUE
        AND m.role IN ('admin', 'super_admin')
    )
  );