import { test, expect } from '@playwright/test'

const mockSession = {
  user: {
    id: 'test-user-id',
    orgId: 'test-org-id',
    name: 'Test User',
    email: 'test@example.com',
    emailVerified: true,
    role: 'admin',
    isActive: true,
    lastLoginAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: Math.floor(Date.now() / 1000) + 3600,
  forcePinChange: false,
  onboardingCompleted: true,
}

test.skip(({ isMobile }) => !isMobile, 'Mobile layout tests only')

test.beforeEach(async ({ page }) => {
  await page.addInitScript((session) => {
    localStorage.setItem('stockflow-session', JSON.stringify(session))
  }, mockSession)
  await page.goto('/')
})

test('mobile bottom navigation is visible', async ({ page }) => {
  await expect(page.getByLabel('Navigation mobile')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Stock' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Mouvements' })).toBeVisible()
})

test('mobile menu sheet opens from bottom nav and navigates', async ({ page }) => {
  await page.getByRole('button', { name: 'Ouvrir le menu' }).last().click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(page.getByRole('link', { name: 'Produits' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Emplacements' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Équipe' })).toBeVisible()

  await page.getByRole('link', { name: 'Produits' }).click()
  await expect(page).toHaveURL('/products')
  await expect(dialog).toBeHidden()
})

test('mobile menu sheet opens from header hamburger', async ({ page }) => {
  await page.getByRole('button', { name: 'Ouvrir le menu' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('bottom nav navigates to primary pages', async ({ page }) => {
  await page.getByRole('link', { name: 'Stock' }).click()
  await expect(page).toHaveURL('/stock')

  await page.getByRole('link', { name: 'Mouvements' }).click()
  await expect(page).toHaveURL('/movements')

  await page.getByRole('link', { name: 'Dashboard' }).click()
  await expect(page).toHaveURL('/')
})
