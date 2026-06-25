import { test, expect } from './fixtures'

test.skip(({ isMobile }) => !isMobile, 'Mobile layout tests only')

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard')
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
  await expect(page).toHaveURL('/dashboard')
})
