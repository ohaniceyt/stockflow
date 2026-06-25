import { test, expect } from './fixtures'
import { cleanupE2EData } from './helpers/supabase'
import fs from 'fs'
import path from 'path'

test.afterEach(async () => {
  await cleanupE2EData('e2e-org-id')
})

test('products page loads and can create a product with a category', async ({ page }) => {
  await page.goto('/products')
  await expect(page.getByRole('heading', { name: 'Produits' })).toBeVisible()

  await page.getByRole('button', { name: /Nouveau produit/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByLabel('Nom du produit *').fill('Ciment E2E')
  await page.getByLabel('Unité *').fill('sac')
  await page.getByLabel("Seuil d'alerte").fill('5')
  await page.getByLabel("Prix d'achat").fill('4500')
  await page.getByLabel('Prix de vente').fill('5200')

  await page.getByLabel('Catégorie').selectOption('+ Nouvelle catégorie')
  await page.getByPlaceholder('Nom de la nouvelle catégorie').fill('Matériaux')
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click()

  await page.getByRole('button', { name: /Créer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()

  // Wait for the visible product card/row that contains both the product name and its category.
  const productCard = page
    .locator('.rounded-xl.border.bg-card:visible')
    .filter({ hasText: 'Ciment E2E' })
    .filter({ hasText: 'Matériaux' })
    .first()
  await expect(productCard).toBeVisible({ timeout: 10000 })
})

test('product can be deactivated and activated', async ({ page }) => {
  await page.goto('/products')
  await expect(page.getByRole('heading', { name: 'Produits' })).toBeVisible()

  await page.getByRole('button', { name: /Nouveau produit/ }).click()
  await page.getByLabel('Nom du produit *').fill('Ciment E2E Toggle')
  await page.getByLabel('Unité *').fill('sac')
  await page.getByRole('button', { name: /Créer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Ciment E2E Toggle').filter({ visible: true }).first()).toBeVisible()

  await page.getByRole('button', { name: /Désactiver Ciment E2E Toggle/ }).click()
  await expect(page.getByRole('button', { name: /Activer Ciment E2E Toggle/ })).toBeVisible()

  await page.getByRole('button', { name: /Activer Ciment E2E Toggle/ }).click()
  await expect(page.getByRole('button', { name: /Désactiver Ciment E2E Toggle/ })).toBeVisible()
})

test('categories tab allows creating and renaming a category', async ({ page }) => {
  await page.goto('/products')
  await expect(page.getByRole('heading', { name: 'Produits' })).toBeVisible()

  await page.getByRole('tab', { name: 'Catégories' }).click()
  await page.getByRole('button', { name: /Nouvelle catégorie/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  await page.getByLabel('Nom de la catégorie *').fill('Électronique')
  await page.getByRole('button', { name: /Créer/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Électronique').filter({ visible: true }).first()).toBeVisible()

  await page.getByRole('button', { name: /Modifier Électronique/ }).click()
  await page.getByLabel('Nom de la catégorie *').fill('Électronique 2')
  await page.getByRole('button', { name: /Mettre à jour/ }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Électronique 2').filter({ visible: true }).first()).toBeVisible()
})

test('can bulk import products from Excel', async ({ page }) => {
  await page.goto('/products')
  await expect(page.getByRole('heading', { name: 'Produits' })).toBeVisible()

  await page.getByRole('button', { name: /Importer/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()

  const exceljs = await import('exceljs')
  const Workbook = exceljs.default.Workbook
  const wb = new Workbook()
  const ws = wb.addWorksheet('Produits')
  ws.addRow([
    'Nom',
    'Catégorie',
    'Unité',
    'Seuil',
    "Prix d'achat",
    'Prix de vente',
    'Fournisseur',
    'Code-barres',
    'Description',
    'Actif',
  ])
  ws.addRow([
    'Ciment Bulk',
    'Matériaux',
    'sac',
    10,
    5000,
    6500,
    'Fournisseur Bulk',
    '123456',
    'Ciment importé',
    'Oui',
  ])

  const buffer = await wb.xlsx.writeBuffer()
  const filePath = path.join(test.info().outputPath(), 'bulk-products.xlsx')
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
  await fs.promises.writeFile(filePath, Buffer.from(buffer))

  await page.getByLabel('Fichier Excel').setInputFiles(filePath)
  await expect(page.getByText(/1 valide\(s\)/)).toBeVisible()

  await page.getByRole('button', { name: /Importer 1 produit/ }).click()
  await expect(page.getByText(/1 produit\(s\) créé\(s\)/)).toBeVisible()

  await page.getByRole('button', { name: 'Fermer' }).first().click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(page.getByText('Ciment Bulk').filter({ visible: true }).first()).toBeVisible()
})
