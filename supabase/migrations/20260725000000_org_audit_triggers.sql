-- Org-level audit logging triggers.
-- Automatically writes to activity_logs for key tables so that org admins can
-- review the history of actions performed in their organization.
--
-- Design choices:
--   - Implemented as PostgreSQL triggers so all mutations are captured,
--     regardless of whether they originate from Edge Functions, direct SQL,
--     or future features.
--   - The helper function is SECURITY DEFINER so it can insert into
--     activity_logs even though RLS blocks authenticated writes.
--   - Details JSONB is kept minimal and never contains PII, tokens, or PINs.

CREATE OR REPLACE FUNCTION log_org_activity(
  p_org_id UUID,
  p_actor_id UUID,
  p_action TEXT,
  p_target_type TEXT,
  p_target_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO activity_logs (
    org_id,
    actor_id,
    action,
    target_type,
    target_id,
    details,
    created_at
  ) VALUES (
    p_org_id,
    p_actor_id,
    p_action,
    p_target_type,
    p_target_id,
    p_details,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.log_org_activity(UUID, UUID, TEXT, TEXT, UUID, JSONB) SET search_path = pg_temp, public, pg_catalog;

-- =============================================================================
-- Trigger function: dispatches to log_org_activity based on table and op.
-- =============================================================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_target_id UUID;
  v_action TEXT;
  v_target_type TEXT;
  v_details JSONB;
  v_actor_id UUID := auth.uid();
BEGIN
  BEGIN
    v_target_type := TG_TABLE_NAME;
    v_action := TG_TABLE_NAME || '_' || lower(TG_OP);

    IF TG_OP = 'DELETE' THEN
      v_target_id := OLD.id;
    ELSE
      v_target_id := NEW.id;
    END IF;

    -- Resolve org_id and build safe details per table.
    IF TG_TABLE_NAME = 'movements' THEN
      IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
      ELSE
        v_org_id := NEW.org_id;
      END IF;
      IF TG_OP = 'INSERT' THEN
        v_details := jsonb_build_object(
          'type', NEW.type,
          'quantity', NEW.quantity,
          'product_id', NEW.product_id,
          'location_id', NEW.location_id
        );
      ELSIF TG_OP = 'UPDATE' THEN
        v_details := jsonb_build_object(
          'type', NEW.type,
          'quantity', NEW.quantity,
          'is_cancelled', NEW.is_cancelled
        );
      END IF;

    ELSIF TG_TABLE_NAME IN ('products', 'contacts', 'locations', 'categories') THEN
      IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
      ELSE
        v_org_id := NEW.org_id;
      END IF;
      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_details := jsonb_build_object('name', NEW.name);
      END IF;

    ELSIF TG_TABLE_NAME = 'organization_memberships' THEN
      IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
        v_details := jsonb_build_object('role', OLD.role);
      ELSE
        v_org_id := NEW.org_id;
        v_details := jsonb_build_object(
          'role', NEW.role,
          'is_active', NEW.is_active,
          'force_pin_change', NEW.force_pin_change
        );
      END IF;

    ELSIF TG_TABLE_NAME = 'organizations' THEN
      IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.id;
      ELSE
        v_org_id := NEW.id;
      END IF;
      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_details := jsonb_build_object(
          'name', NEW.name,
          'currency', NEW.currency,
          'timezone', NEW.timezone
        );
      END IF;

    ELSIF TG_TABLE_NAME = 'inventory_sessions' THEN
      IF TG_OP = 'DELETE' THEN
        v_org_id := OLD.org_id;
      ELSE
        v_org_id := NEW.org_id;
      END IF;
      IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_details := jsonb_build_object(
          'name', NEW.name,
          'status', NEW.status,
          'location_id', NEW.location_id
        );
      END IF;

    ELSE
      -- Unknown table: skip.
      RETURN COALESCE(NEW, OLD);
    END IF;

    -- Details are built explicitly above with non-sensitive, non-PII fields only.
    -- Do NOT add email, phone, token, pin, password, address, or secrets here.

    PERFORM log_org_activity(
      v_org_id,
      v_actor_id,
      v_action,
      v_target_type,
      v_target_id,
      v_details
    );
  EXCEPTION WHEN OTHERS THEN
    -- Never let an audit logging failure break the original business operation.
    RAISE NOTICE 'audit_trigger_func failed for table % op %: %', TG_TABLE_NAME, TG_OP, SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.audit_trigger_func() SET search_path = pg_temp, public, pg_catalog;

-- =============================================================================
-- Attach triggers. We use AFTER triggers so the original operation succeeds
-- before logging; errors in logging must never break the business operation.
-- =============================================================================
DROP TRIGGER IF EXISTS movements_audit_trigger ON movements;
CREATE TRIGGER movements_audit_trigger
  AFTER INSERT OR UPDATE ON movements
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS products_audit_trigger ON products;
CREATE TRIGGER products_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS contacts_audit_trigger ON contacts;
CREATE TRIGGER contacts_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS locations_audit_trigger ON locations;
CREATE TRIGGER locations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON locations
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS categories_audit_trigger ON categories;
CREATE TRIGGER categories_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS organization_memberships_audit_trigger ON organization_memberships;
CREATE TRIGGER organization_memberships_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organization_memberships
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS organizations_audit_trigger ON organizations;
CREATE TRIGGER organizations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();

DROP TRIGGER IF EXISTS inventory_sessions_audit_trigger ON inventory_sessions;
CREATE TRIGGER inventory_sessions_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON inventory_sessions
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
