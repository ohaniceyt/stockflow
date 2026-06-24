import { test, expect } from './fixtures'
import { cleanupE2EData } from './helpers/supabase'

test.afterEach(async () => {
  await cleanupE2EData('e2e-org-id')
})

test('customers page loads and can create a customer', async ({ page }) => {
  await page.goto('/customers')
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible()

  await page.getByRole('button', { name: /Nouveau client/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByLabel('Nom').fill('Client E2E')
  await page.getByLabel('Email').fill('customer@e2e.test')
  await page.getByLabel('Téléphone').fill('+225 05 04 03 02 01')
  await page.getByLabel('Adresse').fill("Bouaké, Côte d'Ivoire")

  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Client E2E')).toBeVisible()
})
