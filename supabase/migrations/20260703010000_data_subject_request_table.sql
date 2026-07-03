---

CREATE TABLE IF NOT EXISTS data_subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('access', 'deletion', 'portability', 'rectification')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  details JSONB DEFAULT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  admin_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_data_subject_requests_user_id ON data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_org_id ON data_subject_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status ON data_subject_requests(status);

ALTER TABLE data_subject_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data subject requests"
  ON data_subject_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own data subject requests"
  ON data_subject_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view org data subject requests"
  ON data_subject_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE user_id = auth.uid()
        AND org_id = data_subject_requests.org_id
        AND role IN ('super_admin', 'admin')
        AND is_active = TRUE
    )
  );

CREATE POLICY "Admins can update org data subject requests"
  ON data_subject_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_memberships
      WHERE user_id = auth.uid()
        AND org_id = data_subject_requests.org_id
        AND role IN ('super_admin', 'admin')
        AND is_active = TRUE
    )
  );
