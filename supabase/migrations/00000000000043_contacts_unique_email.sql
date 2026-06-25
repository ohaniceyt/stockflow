-- Deduplicate active contacts by email within each organization before adding the
-- unique index. Keep the oldest record (by created_at, then id) and clear the
-- email on duplicates so the migration is deployable on existing data.
WITH ranked AS (
  SELECT id,
         org_id,
         email,
         ROW_NUMBER() OVER (PARTITION BY org_id, email ORDER BY created_at, id) AS rnk
  FROM contacts
  WHERE email IS NOT NULL AND is_active = TRUE
)
UPDATE contacts
SET email = NULL
WHERE id IN (SELECT id FROM ranked WHERE rnk > 1);

-- Partial unique index: no duplicate active emails per organization.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_email_unique
  ON contacts(org_id, email)
  WHERE email IS NOT NULL AND is_active = TRUE;

-- Regular index for org/type/active lookups.
CREATE INDEX IF NOT EXISTS idx_contacts_org_type_active
  ON contacts(org_id, type, is_active);
