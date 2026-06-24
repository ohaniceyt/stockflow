-- Signup no longer auto-creates an organization.
-- New accounts start with no membership; they must complete onboarding to create their first org.
-- Invited users skip onboarding because accept-invitation creates their membership directly.

-- Ensure active_org_id is indexed for fast onboarding/invitation lookups.
CREATE INDEX IF NOT EXISTS idx_users_active_org_id ON users(active_org_id);

-- Ensure memberships can exist without a PIN until the user sets one locally.
-- This is already the case from migration 00000000000020, but we re-affirm it here.
DO $$
BEGIN
  ALTER TABLE organization_memberships ALTER COLUMN pin_hash DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;
