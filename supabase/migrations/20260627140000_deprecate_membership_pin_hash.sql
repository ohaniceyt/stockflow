-- Deprecate server-side pin_hash on organization_memberships.
-- The AppLock PIN is now stored locally on each device (IndexedDB).
-- The force_pin_change flag remains to allow admins to force a PIN reset.

UPDATE public.organization_memberships
SET pin_hash = NULL;

ALTER TABLE public.organization_memberships
ALTER COLUMN pin_hash DROP NOT NULL;

-- If the column is still marked NOT NULL from an older schema, this migration ensures it is nullable.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organization_memberships'
      AND column_name = 'pin_hash'
      AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.organization_memberships ALTER COLUMN pin_hash DROP NOT NULL;
  END IF;
END
$$;
