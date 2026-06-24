/**
 * Automated end-to-end test for the Option B onboarding flow.
 *
 * Prerequisites:
 *   - Vite dev server will be started automatically by Playwright (webServer config).
 *   - Local Supabase must be running: `npx supabase start`
 *   - Inbucket must be reachable at INBUCKET_URL (default http://localhost:54324).
 *
 * Run:
 *   npx playwright test tests/e2e/onboarding-option-b.spec.ts
 *   or
 *   npm run test:e2e:onboarding
 */

import { test, expect } from '@playwright/test'
import { extractLink, waitForMessage } from './helpers/inbucket'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
const TEST_USER = {
  name: 'Alice Test',
  // Unique local-part so the test can be repeated without manual DB cleanup.
  email: `alice-test-${String(Date.now())}@localhost`,
  phone: '+225 01 02 03 04 05',
  password: 'MyPassword123!',
  pin: '4242',
  newPin: '7575',
}

test.describe.configure({ mode: 'serial' })

test.describe('Onboarding Option B - email/password + AppLock PIN', () => {
  test('full flow: signup, verify, login, set PIN, lock/unlock, reset PIN', async ({
    page,
    context,
  }) => {
    // 1. Signup
    await page.goto(`${BASE_URL}/signup`)
    await expect(page.getByRole('heading', { name: /Créer votre compte/ })).toBeVisible()

    await page.getByLabel('Nom complet').fill(TEST_USER.name)
    await page.getByLabel('Email').fill(TEST_USER.email)
    await page.getByLabel('Numéro de téléphone').fill(TEST_USER.phone)
    await page.getByLabel('Mot de passe').first().fill(TEST_USER.password)
    await page.getByLabel('Confirmez le mot de passe').fill(TEST_USER.password)
    await page.getByRole('button', { name: /Créer mon compte/ }).click()

    await expect(page.getByText(/Vérifiez votre email/)).toBeVisible()
    await expect(page.getByText(TEST_USER.email)).toBeVisible()

    // 2. Capture the verification email from Inbucket and open the link.
    const verificationEmail = await waitForMessage(TEST_USER.email)
    const verificationLink = extractLink(verificationEmail.text, '/auth/verification')
    if (!verificationLink) throw new Error('No verification link found in email')

    // Open the verification link in a fresh page so the OTP hash is processed cleanly.
    const verifyPage = await context.newPage()
    await verifyPage.goto(verificationLink)
    await expect(verifyPage.getByText(/Votre email est vérifié/)).toBeVisible()
    await verifyPage.waitForURL(/\/login\?verified=1/)
    await verifyPage.close()

    // 3. Login with email and password.
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel('Email').fill(TEST_USER.email)
    await page.getByLabel('Mot de passe').fill(TEST_USER.password)
    await page.getByRole('button', { name: /Se connecter/ }).click()

    await page.waitForURL(`${BASE_URL}/dashboard`)
    await expect(page.getByRole('heading', { name: /Tableau de bord/ })).toBeVisible()

    // 4. Set the AppLock PIN from the dashboard prompt.
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByText(/Sécurisez votre accès/)).toBeVisible()
    await page.getByLabel('Nouveau PIN').fill(TEST_USER.pin)
    await page.getByLabel('Confirmer le PIN').fill(TEST_USER.pin)
    await page.getByRole('button', { name: /Activer le verrouillage/ }).click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // 5. Simulate leaving the app: clear session memory but keep localStorage PIN.
    //    Reloading should trigger the AppLock overlay.
    await page.reload()
    await expect(page.getByText(/StockFlow est verrouillé/)).toBeVisible()

    await page.locator('input[placeholder="Entrez votre PIN"]').fill(TEST_USER.pin)
    await page.getByRole('button', { name: /Déverrouiller/ }).click()
    await expect(page.getByRole('heading', { name: /Tableau de bord/ })).toBeVisible()

    // 6. Trigger a PIN reset from the AppLock overlay.
    await page.reload()
    await expect(page.getByText(/StockFlow est verrouillé/)).toBeVisible()
    await page.getByRole('button', { name: /PIN oublié/ }).click()
    await expect(page.getByText(/lien de déverrouillage a été envoyé/)).toBeVisible()

    // Capture the magic link email and open it.
    const resetEmail = await waitForMessage(TEST_USER.email)
    const resetLink = extractLink(resetEmail.text, '/auth/reset-pin')
    if (!resetLink) throw new Error('No PIN reset link found in email')

    const resetPage = await context.newPage()
    await resetPage.goto(resetLink)
    await expect(resetPage.getByText(/Choisissez un nouveau PIN/)).toBeVisible()

    await resetPage.getByLabel('Nouveau PIN').fill(TEST_USER.newPin)
    await resetPage.getByLabel('Confirmez le PIN').fill(TEST_USER.newPin)
    await resetPage.getByRole('button', { name: /Enregistrer le nouveau PIN/ }).click()
    await resetPage.waitForURL(`${BASE_URL}/dashboard`)
    await expect(resetPage.getByRole('heading', { name: /Tableau de bord/ })).toBeVisible()
    await resetPage.close()

    // 7. Verify the new PIN unlocks the app.
    await page.reload()
    await expect(page.getByText(/StockFlow est verrouillé/)).toBeVisible()
    await page.locator('input[placeholder="Entrez votre PIN"]').fill(TEST_USER.newPin)
    await page.getByRole('button', { name: /Déverrouiller/ }).click()
    await expect(page.getByRole('heading', { name: /Tableau de bord/ })).toBeVisible()
  })

  test('forgot password flow sends reset link', async ({ page, context }) => {
    // This test assumes a previously verified account exists.
    // For repeatability it reuses the same generated email after the signup test.
    const email = TEST_USER.email

    await page.goto(`${BASE_URL}/login`)
    await page.getByRole('link', { name: /Mot de passe oublié/ }).click()
    await page.waitForURL(/\/auth\/forgot-password/)

    await page.getByLabel('Email').fill(email)
    await page.getByRole('button', { name: /Envoyer/ }).click()

    await expect(page.getByText(/Si ce compte existe/)).toBeVisible()

    const resetEmail = await waitForMessage(email)
    const resetLink = extractLink(resetEmail.text, '/auth/reset-password')
    if (!resetLink) throw new Error('No password reset link found in email')

    const resetPage = await context.newPage()
    await resetPage.goto(resetLink)
    await expect(resetPage.getByRole('heading', { name: /Nouveau mot de passe/ })).toBeVisible()
  })
})
