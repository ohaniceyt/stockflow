import { test, expect } from './fixtures'
import { cleanupE2EData } from './helpers/supabase'

test.afterEach(async () => {
  await cleanupE2EData('e2e-org-id')
})

test('movements page loads and can record an IN movement', async ({ page }) => {
  await page.goto('/movements')
  await expect(page.getByRole('heading', { name: 'Mouvements' })).toBeVisible()

  await page.getByRole('button', { name: /Nouveau mouvement/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByLabel('Type de mouvement').selectOption('IN')

  const productSelect = page.getByLabel('Produit')
  await expect(productSelect).toBeVisible()
  const productOptions = await productSelect.locator('option').allTextContents()
  const firstProduct = productOptions.find((o) => o && o !== 'Choisir un produit…')
  if (!firstProduct) {
    throw new Error('Aucun produit disponible pour créer un mouvement')
  }
  await productSelect.selectOption({ label: firstProduct })

  const locationSelect = page.getByLabel('Emplacement')
  await expect(locationSelect).toBeVisible()
  const locationOptions = await locationSelect.locator('option').allTextContents()
  const firstLocation = locationOptions.find((o) => o && o !== 'Choisir un emplacement…')
  if (!firstLocation) {
    throw new Error('Aucun emplacement disponible pour créer un mouvement')
  }
  await locationSelect.selectOption({ label: firstLocation })

  await page.getByLabel('Quantité').fill('10')
  await page.getByLabel('Motif').fill('Réception E2E')

  await page.getByRole('button', { name: /Enregistrer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  await expect(page.getByText('Entrée').first()).toBeVisible()
})
