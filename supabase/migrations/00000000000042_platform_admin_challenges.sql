CREATE TABLE platform_admin_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_platform_admin_challenges_user_created
  ON platform_admin_challenges(auth_user_id, created_at);

CREATE INDEX idx_platform_admin_challenges_expires
  ON platform_admin_challenges(expires_at);
