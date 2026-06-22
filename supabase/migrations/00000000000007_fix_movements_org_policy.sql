-- Restore org-scoping to the movements write policy.
-- The recursion fix (migration 06) removed the org check to avoid querying users inside
-- the users-table policies, but movements are not users, so we can safely verify that the
-- referenced product and location both belong to the current user's organization.
DROP POLICY IF EXISTS movements_org_write ON movements;

CREATE POLICY movements_org_write ON movements
  FOR INSERT TO authenticated
  WITH CHECK (
    current_user_is_operator_or_above()
    AND operator_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM products p
      JOIN locations l ON l.id = movements.location_id
      WHERE p.id = movements.product_id
        AND p.org_id = current_user_org_id()
        AND l.org_id = current_user_org_id()
    )
  );
