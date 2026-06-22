-- Add onboarding completion flag to organizations
ALTER TABLE organizations ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE;

-- Backfill existing organizations as already onboarded
UPDATE organizations SET onboarding_completed = TRUE;

-- Allow locations description to be optional (already nullable) and ensure is_default constraint is present
-- The initial schema already has one_default_per_org unique constraint.
