-- Harden access-control policies after the access-control audit.
-- Targets: platform_admins, organization_memberships, users, products, movements,
-- receipts/invoices, organization_api_keys, platform_admin_challenges,
-- api_request_logs, data_subject_requests.

-- 1. platform_admins: only super_admins may write; any active platform admin may read.
DROP POLICY IF EXISTS platform_admins_super_all ON platform_admins;

CREATE POLICY platform_admins_read ON platform_admins
  FOR SELECT TO authenticated
  USING (is_platform_admin());

CREATE POLICY platform_admins_super_admin_write ON platform_admins
  FOR INSERT TO authenticated
  WITH CHECK (platform_admin_role(auth.uid()) = 'super_admin');

CREATE POLICY platform_admins_super_admin_update ON platform_admins
  FOR UPDATE TO authenticated
  USING (platform_admin_role(auth.uid()) = 'super_admin')
  WITH CHECK (platform_admin_role(auth.uid()) = 'super_admin');

CREATE POLICY platform_admins_super_admin_delete ON platform_admins
  FOR DELETE TO authenticated
  USING (platform_admin_role(auth.uid()) = 'super_admin');

-- 2. organization_memberships: enforce role hierarchy.
-- super_admins keep full control. Admins can manage non-super-admin members but cannot
-- promote anyone (including themselves) to super_admin. A trigger blocks updates that
-- target an existing super_admin record unless the actor is also a super_admin.
DROP POLICY IF EXISTS organization_memberships_org_admin ON organization_memberships;

CREATE POLICY organization_memberships_super_admin_all ON organization_memberships
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role = 'super_admin'
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role = 'super_admin'
    )
  );

CREATE POLICY organization_memberships_admin_manage ON organization_memberships
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role = 'admin'
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role = 'admin'
    )
    AND role IN ('admin', 'operator', 'cashier', 'reader')
  );

-- Trigger enforcing hierarchy: an admin cannot modify a row whose current role is
-- super_admin, and no one can set role = super_admin through the admin policy path.
CREATE OR REPLACE FUNCTION enforce_membership_role_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  actor_role TEXT;
BEGIN
  -- Resolve the active membership role of the caller. Platform admins bypass org scoping
  -- and are treated as super_admin for this trigger.
  IF is_platform_admin() THEN
    actor_role := COALESCE(platform_admin_role(auth.uid()), 'super_admin');
  ELSE
    actor_role := current_user_role();
  END IF;

  -- Only super_admin may touch an existing super_admin membership.
  IF TG_OP = 'UPDATE' AND OLD.role = 'super_admin' AND actor_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only a super_admin can modify a super_admin membership';
  END IF;

  -- Only super_admin may create or promote to super_admin.
  IF NEW.role = 'super_admin' AND actor_role != 'super_admin' THEN
    RAISE EXCEPTION 'Only a super_admin can create or promote to super_admin';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS organization_memberships_role_hierarchy ON organization_memberships;
CREATE TRIGGER organization_memberships_role_hierarchy
  BEFORE INSERT OR UPDATE ON organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION enforce_membership_role_hierarchy();

-- 3. users: tighten WITH CHECK so admin edits stay within the active org and require role.
DROP POLICY IF EXISTS users_org_admin_manage ON users;

CREATE POLICY users_org_admin_manage ON users
  FOR ALL TO authenticated
  USING (
    id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM current_membership() cm WHERE cm.role IN ('super_admin', 'admin')
      )
      AND EXISTS (
        SELECT 1 FROM organization_memberships m
        WHERE m.user_id = users.id
          AND m.org_id = current_user_org_id()
          AND m.is_active = TRUE
      )
    )
  )
  WITH CHECK (
    id = auth.uid()
    OR (
      EXISTS (
        SELECT 1 FROM current_membership() cm WHERE cm.role IN ('super_admin', 'admin')
      )
      AND EXISTS (
        SELECT 1 FROM organization_memberships m
        WHERE m.user_id = users.id
          AND m.org_id = current_user_org_id()
          AND m.is_active = TRUE
      )
    )
  );

-- 4. products: WITH CHECK must also require admin/super_admin role.
DROP POLICY IF EXISTS products_org_admin_write ON products;

CREATE POLICY products_org_admin_write ON products
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

-- 5. movements: INSERT must be scoped to the active org.
DROP POLICY IF EXISTS movements_org_write ON movements;

CREATE POLICY movements_org_write ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'operator', 'super_admin')
    )
    AND operator_id = auth.uid()
  );

-- 6. receipts / receipt_items: split SELECT (any active member) from writes (admin/super_admin).
DROP POLICY IF EXISTS org_isolation_receipts ON receipts;
DROP POLICY IF EXISTS org_isolation_receipt_items ON receipt_items;

CREATE POLICY receipts_org_select ON receipts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = receipts.org_id AND m.is_active = TRUE
  ));

CREATE POLICY receipts_org_admin_write ON receipts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = receipts.org_id AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = receipts.org_id AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY receipt_items_org_select ON receipt_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM receipts r
    JOIN organization_memberships m ON m.org_id = r.org_id
    WHERE r.id = receipt_items.receipt_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ));

CREATE POLICY receipt_items_org_admin_write ON receipt_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN organization_memberships m ON m.org_id = r.org_id
      WHERE r.id = receipt_items.receipt_id AND m.user_id = auth.uid() AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM receipts r
      JOIN organization_memberships m ON m.org_id = r.org_id
      WHERE r.id = receipt_items.receipt_id AND m.user_id = auth.uid() AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

-- 7. invoices / invoice_items / invoice_sequences: split SELECT from writes.
DROP POLICY IF EXISTS org_isolation_invoices ON invoices;
DROP POLICY IF EXISTS org_isolation_invoice_items ON invoice_items;
DROP POLICY IF EXISTS org_isolation_invoice_sequences ON invoice_sequences;

CREATE POLICY invoices_org_select ON invoices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = invoices.org_id AND m.is_active = TRUE
  ));

CREATE POLICY invoices_org_admin_write ON invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = invoices.org_id AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = invoices.org_id AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY invoice_items_org_select ON invoice_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN organization_memberships m ON m.org_id = i.org_id
    WHERE i.id = invoice_items.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ));

CREATE POLICY invoice_items_org_admin_write ON invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN organization_memberships m ON m.org_id = i.org_id
      WHERE i.id = invoice_items.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      JOIN organization_memberships m ON m.org_id = i.org_id
      WHERE i.id = invoice_items.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY invoice_sequences_org_select ON invoice_sequences
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = invoice_sequences.org_id AND m.is_active = TRUE
  ));

CREATE POLICY invoice_sequences_org_admin_write ON invoice_sequences
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = invoice_sequences.org_id AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM organization_memberships m
      WHERE m.user_id = auth.uid() AND m.org_id = invoice_sequences.org_id AND m.is_active = TRUE
    )
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

-- 8. organization_api_keys: restrict read/update/delete to admin/super_admin.
DROP POLICY IF EXISTS organization_api_keys_org_select ON organization_api_keys;
DROP POLICY IF EXISTS organization_api_keys_org_insert ON organization_api_keys;
DROP POLICY IF EXISTS organization_api_keys_org_update ON organization_api_keys;
DROP POLICY IF EXISTS organization_api_keys_org_delete ON organization_api_keys;

CREATE POLICY organization_api_keys_org_select ON organization_api_keys
  FOR SELECT TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY organization_api_keys_org_insert ON organization_api_keys
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY organization_api_keys_org_update ON organization_api_keys
  FOR UPDATE TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY organization_api_keys_org_delete ON organization_api_keys
  FOR DELETE TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm WHERE cm.role IN ('admin', 'super_admin')
    )
  );

-- 9. platform_admin_challenges: enable RLS. Service-role functions bypass RLS automatically.
ALTER TABLE platform_admin_challenges ENABLE ROW LEVEL SECURITY;

-- Authenticated users can only see their own pending/expired challenges (mainly for debugging).
CREATE POLICY platform_admin_challenges_owner_select ON platform_admin_challenges
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- 10. api_request_logs: enable RLS. Only service-role should write; reads reserved for platform admins.
ALTER TABLE api_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY api_request_logs_platform_read ON api_request_logs
  FOR SELECT TO authenticated
  USING (is_platform_admin());

-- 11. data_subject_requests: insert must belong to the active org.
DROP POLICY IF EXISTS "Users can insert own data subject requests" ON data_subject_requests;

CREATE POLICY "Users can insert own data subject requests"
  ON data_subject_requests FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND org_id = current_user_org_id()
  );
