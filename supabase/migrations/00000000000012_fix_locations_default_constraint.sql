-- Fix the incorrect unique constraint that prevented multiple non-default locations per org.
-- The previous constraint UNIQUE (org_id, is_default) clashed on every row where is_default = false.

ALTER TABLE locations
DROP CONSTRAINT IF EXISTS one_default_per_org;

-- Partial unique index: only one default location per org, unlimited non-default locations.
CREATE UNIQUE INDEX IF NOT EXISTS one_default_per_org
ON locations (org_id)
WHERE is_default = TRUE;
