import { test, expect } from './fixtures'
import { cleanupE2EData } from './helpers/supabase'

test.afterEach(async () => {
  await cleanupE2EData('e2e-org-id')
})

test('analytics page loads with default period and stat cards', async ({ page }) => {
  await page.goto('/analytics')
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()

  await expect(page.getByRole('button', { name: /Aujourd'hui/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Semaine/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Mois/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Dates/ })).toBeVisible()

  await expect(page.getByTestId('recap-movements-card')).toBeVisible()
  await expect(page.getByText('MARGE PRÉVUE').first()).toBeVisible()
  await expect(page.getByText('CA RÉEL').first()).toBeVisible()
  await expect(page.getByText('BÉNÉFICE RÉALISÉ').first()).toBeVisible()

  await expect(page.getByText('Flux entrées / sorties')).toBeVisible()
})

test('analytics can switch to custom dates with validation', async ({ page }) => {
  await page.goto('/analytics')
  await page.getByRole('button', { name: /Dates/ }).click()

  await expect(page.getByLabel('Du')).toBeVisible()
  await expect(page.getByLabel('Au')).toBeVisible()

  const today = new Date().toISOString().slice(0, 10)
  await page.getByLabel('Du').fill(today)
  await page.getByLabel('Au').fill(today)

  await expect(page.getByRole('button', { name: /Excel/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /PDF/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /WhatsApp/ })).toBeVisible()
})

test('/recap redirects to /analytics', async ({ page }) => {
  await page.goto('/recap')
  await expect(page).toHaveURL(/\/analytics$/)
  await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible()
})
