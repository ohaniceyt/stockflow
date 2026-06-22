-- Seed data for local development and initial Supabase setup

INSERT INTO organizations (id, name, currency, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'StockFlow Demo',
  'XOF',
  'Africa/Abidjan'
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
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'Alice Admin',
    'alice.admin@stockflow.local',
    'admin',
    'pbkdf2$c29tZXNhbHQ=$S9dTViH7f5Wj53vUEHt0pPSCjxzCXtgV/crDQdKbhMo=',
    TRUE,
    FALSE
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000000',
    'Bob Opérateur',
    'bob.operateur@stockflow.local',
    'operator',
    'pbkdf2$c29tZXNhbHQ=$S9dTViH7f5Wj53vUEHt0pPSCjxzCXtgV/crDQdKbhMo=',
    TRUE,
    FALSE
  )
ON CONFLICT (id) DO NOTHING;
