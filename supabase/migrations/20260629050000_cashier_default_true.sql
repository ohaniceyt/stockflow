-- SF-023: Enable cashier by default for new organizations.
ALTER TABLE organizations ALTER COLUMN has_cashier_enabled SET DEFAULT TRUE;

-- Also enable for existing organizations that completed onboarding without explicitly disabling it.
-- The column tracking onboarding completion is named `onboarding_completed` in this schema.
UPDATE organizations
SET has_cashier_enabled = TRUE
WHERE onboarding_completed = TRUE
  AND has_cashier_enabled = FALSE;
