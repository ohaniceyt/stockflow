-- Support phone number during onboarding and allow accounts to exist without
-- an AppLock PIN until the user sets it from the dashboard.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE public.organization_memberships
  ALTER COLUMN pin_hash DROP NOT NULL;

COMMENT ON COLUMN public.users.phone IS 'User phone number collected during signup (not verified by default).';
COMMENT ON COLUMN public.organization_memberships.pin_hash IS 'PBKDF2 hash of the AppLock PIN. NULL until the user sets it in the dashboard.';
