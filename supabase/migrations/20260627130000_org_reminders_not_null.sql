-- Backfill organization reminder defaults and enforce NOT NULL.
-- The TypeScript Organization model expects booleans/numbers to be non-null.

UPDATE public.organizations
SET
  auto_reminder_enabled = COALESCE(auto_reminder_enabled, FALSE),
  auto_reminder_days = COALESCE(auto_reminder_days, 3);

ALTER TABLE public.organizations
ALTER COLUMN auto_reminder_enabled SET NOT NULL,
ALTER COLUMN auto_reminder_enabled SET DEFAULT FALSE,
ALTER COLUMN auto_reminder_days SET NOT NULL,
ALTER COLUMN auto_reminder_days SET DEFAULT 3;
