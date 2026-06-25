CREATE TABLE IF NOT EXISTS api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES organization_api_keys(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  method TEXT,
  path TEXT,
  ip_address TEXT,
  status_code INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_org_created
  ON api_request_logs(org_id, created_at);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_key_created
  ON api_request_logs(api_key_id, created_at);
