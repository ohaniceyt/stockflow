-- Seed data for local development and initial Supabase setup

INSERT INTO organizations (id, name, currency, timezone, onboarding_completed)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'StockFlow Demo',
  'XOF',
  'Africa/Abidjan',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Default location
INSERT INTO locations (id, org_id, name, description, is_default)
VALUES (
  '10000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'Dépôt principal',
  'Emplacement par défaut',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

-- Demo users with PIN '1234' hashed as pbkdf2$salt$hash
-- salt (base64): c29tZXNhbHQ= (literal 'somesalt' for demo only)
-- hash of '1234' with PBKDF2 100k iterations, SHA-256, salt='somesalt'
INSERT INTO users (id, org_id, name, email, role, pin_hash, is_active, force_pin_change)
VALUES
  (
    '584a7634-fbed-41ad-a947-b104d013ee96',
    '00000000-0000-0000-0000-000000000000',
    'Alice Admin',
    'earful-wannabe-wok@duck.com',
    'admin',
    'pbkdf2$c29tZXNhbHQ=$S9dTViH7f5Wj53vUEHt0pPSCjxzCXtgV/crDQdKbhMo=',
    TRUE,
    FALSE
  ),
  (
    '0c14cf03-5341-4b95-bb9e-eb0fbcd16836',
    '00000000-0000-0000-0000-000000000000',
    'Bob Opérateur',
    'lagged-poach-decoy@duck.com',
    'operator',
    'pbkdf2$c29tZXNhbHQ=$S9dTViH7f5Wj53vUEHt0pPSCjxzCXtgV/crDQdKbhMo=',
    TRUE,
    FALSE
  )
ON CONFLICT (id) DO NOTHING;
