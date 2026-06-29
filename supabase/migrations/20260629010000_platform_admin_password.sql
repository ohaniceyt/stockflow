-- Platform admin challenge hardening.
-- Adds a password_hash column so the challenge endpoint can actually verify
-- the administrator password instead of accepting any input.

ALTER TABLE platform_admins
ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Track failed challenge attempts to enable lockout / rate-limiting.
ALTER TABLE platform_admins
ADD COLUMN IF NOT EXISTS failed_challenge_attempts INTEGER NOT NULL DEFAULT 0;

-- Lockout after too many failed attempts (resets on successful set-password).
ALTER TABLE platform_admins
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
