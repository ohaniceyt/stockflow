-- Ensure existing organizations are marked onboarded for smooth login flow.
UPDATE organizations SET onboarding_completed = TRUE WHERE onboarding_completed = FALSE;
