-- Ensure organization reminder columns exist.
-- Earlier migration 20260626091500 attempted to add them; this migration is idempotent.

ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS auto_reminder_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS auto_reminder_days INTEGER DEFAULT 3;
