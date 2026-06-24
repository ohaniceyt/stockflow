import { test, expect } from './fixtures'
import { cleanupE2EData } from './helpers/supabase'

test.afterEach(async () => {
  await cleanupE2EData('e2e-org-id')
})

test('suppliers page loads and can create a supplier', async ({ page }) => {
  await page.goto('/suppliers')
  await expect(page.getByRole('heading', { name: 'Fournisseurs' })).toBeVisible()

  await page.getByRole('button', { name: /Nouveau fournisseur/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByLabel('Nom').fill('Fournisseur E2E')
  await page.getByLabel('Email').fill('supplier@e2e.test')
  await page.getByLabel('Téléphone').fill('+225 01 02 03 04 05')
  await page.getByLabel('Adresse').fill("Abidjan, Côte d'Ivoire")

  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Fournisseur E2E')).toBeVisible()
})

test('supplier status can be toggled', async ({ page }) => {
  await page.goto('/suppliers')
  await expect(page.getByRole('heading', { name: 'Fournisseurs' })).toBeVisible()

  await page.getByRole('button', { name: /Nouveau fournisseur/ }).click()
  await page.getByLabel('Nom').fill('Fournisseur E2E Toggle')
  await page.getByLabel('Email').fill('supplier-toggle@e2e.test')
  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Fournisseur E2E Toggle').first()).toBeVisible()

  const row = page.locator('div.rounded-xl.border').filter({ hasText: 'Fournisseur E2E Toggle' })
  await row.getByRole('button', { name: /Désactiver/ }).click()
  await expect(row.getByText('Inactif')).toBeVisible()

  await row.getByRole('button', { name: /Activer/ }).click()
  await expect(row.getByText('Actif')).toBeVisible()
})
