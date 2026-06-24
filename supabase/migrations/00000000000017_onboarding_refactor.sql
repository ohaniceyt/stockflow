-- Onboarding refactor: unify signup + onboarding wizard and enable public invitation links.

-- 1. Invitation tokens for public accept links
ALTER TABLE invitations
  ADD COLUMN token UUID UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN expires_at TIMESTAMPTZ,
  ADD COLUMN name TEXT;

CREATE INDEX idx_invitations_token ON invitations(token);

-- 2. New organisations should start unconfigured so the onboarding wizard runs.
ALTER TABLE organizations ALTER COLUMN onboarding_completed SET DEFAULT FALSE;
