/**
 * E2E test for the platform admin BackOffice.
 *
 * Prerequisites:
 *   - Dev server running (Playwright webServer config).
 *   - Supabase project must have a platform admin account with the credentials below.
 *   - At least one non-suspended organization must exist to test the sudo flow.
 *
 * Run:
 *   npx playwright test tests/e2e/back-office.spec.ts
 */

import { test, expect } from '@playwright/test'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

// Hard-coded platform admin credentials provided by the user.
const PLATFORM_ADMIN = {
  email: 'su@app.grandigix.com',
  password: 'Zsysmx3fQmSVFe23',
}

async function login(page: import('@playwright/test').Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mot de passe').fill(password)
  await page.getByRole('button', { name: /Se connecter/ }).click()
  await page.waitForURL(/\/dashboard/)
}

async function setupPinIfNeeded(page: import('@playwright/test').Page) {
  const dialog = page.getByRole('dialog')
  if (await dialog.isVisible().catch(() => false)) {
    const pin = '4242'
    await page.getByLabel('Nouveau PIN').fill(pin)
    await page.getByLabel('Confirmer le PIN').fill(pin)
    await page.getByRole('button', { name: /Activer le verrouillage/ }).click()
    await expect(dialog).toBeHidden()
  }
}

test.describe('BackOffice platform admin', () => {
  test('overview loads, organisations list works, sudo enters and exits', async ({ page }) => {
    await login(page, PLATFORM_ADMIN.email, PLATFORM_ADMIN.password)
    await setupPinIfNeeded(page)

    // 1. Open Back Office from the main nav once it is rendered.
    const backOfficeLink = page.getByTestId('nav-back-office')
    await expect(backOfficeLink).toBeVisible({ timeout: 10000 })
    await backOfficeLink.click()
    await page.waitForURL(/\/back-office\/?$/)

    await expect(page.getByRole('heading', { name: /Vue d'ensemble/ })).toBeVisible()
    await expect(page.getByText('Organisations actives')).toBeVisible()
    await expect(page.getByText('Utilisateurs en ligne')).toBeVisible()

    // 2. Navigate to Organisations list.
    await page.getByRole('link', { name: /Organisations/ }).click()
    await page.waitForURL(/\/back-office\/organizations/)
    await expect(page.getByRole('heading', { name: /Organisations/ })).toBeVisible()

    // Wait for the table to populate.
    const rows = page.locator('table tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 10000 })

    const firstOrgName = await rows.first().locator('td').first().textContent()
    expect(firstOrgName).toBeTruthy()

    // 3. Click the first row to open organisation detail.
    await rows.first().locator('td').first().locator('button').click()
    await page.waitForURL(/\/back-office\/organizations\/[^/]+/)
    await expect(page.getByRole('heading', { name: firstOrgName ?? '' })).toBeVisible()

    // 4. Enter sudo from the detail page.
    const sudoButton = page.getByRole('button', { name: /Sudo/ }).first()
    await expect(sudoButton).toBeVisible()
    await sudoButton.click()

    // We should land on the dashboard in sudo context.
    await page.waitForURL(/\/dashboard/)
    const sudoBanner = page.getByTestId('sudo-banner')
    await expect(sudoBanner).toBeVisible()
    await expect(sudoBanner).toContainText(firstOrgName ?? '')

    // 5. Exit sudo via the banner.
    await page.getByRole('button', { name: /Quitter le sudo/ }).click()
    await expect(page.getByText(/Sudo actif/)).toBeHidden()

    // 6. Go back to BackOffice and open Audit Logs.
    await page
      .getByRole('navigation')
      .getByRole('link', { name: /Back Office/ })
      .click()
    await page.getByRole('link', { name: /Audit/ }).click()
    await page.waitForURL(/\/back-office\/audit-logs/)
    await expect(page.getByRole('heading', { name: /Journal d'audit/ })).toBeVisible()
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 10000 })
  })
})
