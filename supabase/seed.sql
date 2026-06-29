-- Seed data for local development and E2E tests only.
-- This file is intentionally free of any production credentials or demo accounts
-- with known passwords. Do NOT run this seed against a production database.

INSERT INTO organizations (id, name, slug, currency, timezone, onboarding_completed)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'StockFlow Demo',
  'stockflow-demo',
  'XOF',
  'Africa/Abidjan',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Default location for the demo organization.
INSERT INTO locations (id, org_id, name, description, is_default)
VALUES (
  '10000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'Dépôt principal',
  'Emplacement par défaut',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Demo user accounts with a known PIN have been removed for security.
-- To create a local admin account, run the script located at:
--   scripts/seed-local-admin.ts
-- It will generate a random strong PIN and print it once.
