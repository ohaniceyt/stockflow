-- Centralized server-side queue mirror for offline operations.
-- This table is a visibility/management layer, NOT the source of truth:
-- the Dexie local queue remains authoritative on each device.
--
-- Why centralized?
--   - Org admins must see and manage stuck operations from any device.
--   - Support team can inspect the queue without accessing the user's browser.
--   - Allows future server-side retry workers.

CREATE TABLE IF NOT EXISTS org_pending_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_operation_id UUID NOT NULL,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL CHECK (status IN ('pending', 'syncing', 'failed', 'dead', 'cancelled', 'completed')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, client_operation_id)
);

CREATE INDEX IF NOT EXISTS idx_org_pending_operations_org_status
  ON org_pending_operations(org_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_org_pending_operations_client_op
  ON org_pending_operations(org_id, client_operation_id);

-- Enable RLS (default deny) and allow reads only for active org members with
-- admin/operator-or-above roles. Writes are reserved for Edge Functions via
-- service-role key.
ALTER TABLE org_pending_operations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_pending_operations_select ON org_pending_operations;
CREATE POLICY org_pending_operations_select ON org_pending_operations
  FOR SELECT TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM current_membership() cm
      WHERE cm.role IN ('admin', 'super_admin')
    )
  );

-- Helper to upsert a pending operation from an Edge Function.
CREATE OR REPLACE FUNCTION upsert_org_pending_operation(
  p_client_operation_id UUID,
  p_org_id UUID,
  p_actor_id UUID,
  p_type TEXT,
  p_payload JSONB,
  p_status TEXT,
  p_retry_count INTEGER DEFAULT 0,
  p_error TEXT DEFAULT NULL,
  p_next_retry_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO org_pending_operations (
    client_operation_id,
    org_id,
    actor_id,
    type,
    payload,
    status,
    retry_count,
    error,
    next_retry_at,
    created_at,
    updated_at
  ) VALUES (
    p_client_operation_id,
    p_org_id,
    p_actor_id,
    p_type,
    p_payload,
    p_status,
    p_retry_count,
    p_error,
    p_next_retry_at,
    NOW(),
    NOW()
  )
  ON CONFLICT (org_id, client_operation_id)
  DO UPDATE SET
    actor_id = EXCLUDED.actor_id,
    type = EXCLUDED.type,
    payload = EXCLUDED.payload,
    status = EXCLUDED.status,
    retry_count = EXCLUDED.retry_count,
    error = EXCLUDED.error,
    next_retry_at = EXCLUDED.next_retry_at,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION public.upsert_org_pending_operation(UUID, UUID, UUID, TEXT, JSONB, TEXT, INTEGER, TEXT, TIMESTAMPTZ) SET search_path = pg_temp, public, pg_catalog;

REVOKE EXECUTE ON FUNCTION public.upsert_org_pending_operation(UUID, UUID, UUID, TEXT, JSONB, TEXT, INTEGER, TEXT, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION public.upsert_org_pending_operation(UUID, UUID, UUID, TEXT, JSONB, TEXT, INTEGER, TEXT, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_org_pending_operation(UUID, UUID, UUID, TEXT, JSONB, TEXT, INTEGER, TEXT, TIMESTAMPTZ) TO authenticated;

-- Audit trigger for queue management actions.
DROP TRIGGER IF EXISTS org_pending_operations_audit_trigger ON org_pending_operations;
CREATE TRIGGER org_pending_operations_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON org_pending_operations
  FOR EACH ROW
  EXECUTE FUNCTION audit_trigger_func();
