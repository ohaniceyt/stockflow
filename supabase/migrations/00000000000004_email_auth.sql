-- Add email columns to users
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill real demo emails for existing demo users
UPDATE users
SET email = CASE
  WHEN name = 'Alice Admin' THEN 'earful-wannabe-wok@duck.com'
  WHEN name = 'Bob Opérateur' THEN 'lagged-poach-decoy@duck.com'
  ELSE LOWER(REPLACE(name, ' ', '.')) || '@stockflow.local'
END,
id = CASE
  WHEN name = 'Alice Admin' THEN '584a7634-fbed-41ad-a947-b104d013ee96'
  WHEN name = 'Bob Opérateur' THEN '0c14cf03-5341-4b95-bb9e-eb0fbcd16836'
  ELSE id
END
WHERE email IS NULL;

-- Make email required going forward
ALTER TABLE users ALTER COLUMN email SET NOT NULL;

-- Add unique constraint per org
ALTER TABLE users ADD CONSTRAINT users_org_email_unique UNIQUE (org_id, email);
