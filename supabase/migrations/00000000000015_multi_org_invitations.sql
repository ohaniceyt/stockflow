-- Multi-org invitations: allow users to be invited to several organizations

CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'reader')),
  invited_by UUID NOT NULL REFERENCES users(id),
  status invitation_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (org_id, email, status)
);

-- Index for listing pending invitations by email or org
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_org ON invitations(org_id);

-- Trigger for updated_at
CREATE TRIGGER update_invitations_updated_at BEFORE UPDATE ON invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Users can read invitations sent to their email
CREATE POLICY invitations_recipient_read ON invitations
  FOR SELECT TO authenticated
  USING (email = auth.email());

-- Org admins/super_admin can read and manage invitations for their org
CREATE POLICY invitations_org_manage ON invitations
  FOR ALL TO authenticated
  USING (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND org_id = invitations.org_id
        AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    org_id = current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND org_id = invitations.org_id
        AND role IN ('super_admin', 'admin')
    )
  );

-- Drop unique email constraint on users to allow one auth user across multiple orgs
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;

-- Ensure the combination of org + email stays unique within an org
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_org_email ON users(org_id, email);
