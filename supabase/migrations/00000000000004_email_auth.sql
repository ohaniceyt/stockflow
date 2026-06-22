-- Add email columns to users
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill placeholder emails for existing demo users
UPDATE users SET email = LOWER(REPLACE(name, ' ', '.')) || '@stockflow.local' WHERE email IS NULL;

-- Make email required going forward
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add unique constraint per org
ALTER TABLE users ADD CONSTRAINT users_org_email_unique UNIQUE (org_id, email);
