import { test, expect } from './fixtures'
import { cleanupE2EData } from './helpers/supabase'

test.afterEach(async () => {
  await cleanupE2EData('e2e-org-id')
})

test.describe('Org settings - audit logs', () => {
  test('audit logs page loads and displays seeded log', async ({ page }) => {
    await page.goto('/settings/audit-logs')

    await expect(page.getByRole('heading', { name: 'Journal d’audit' })).toBeVisible()
    await expect(
      page.getByText('Historique des actions effectuées dans cette organisation.')
    ).toBeVisible()

    // The seeded audit log from mockBackend should appear.
    await expect(page.getByText('products_insert')).toBeVisible()
    await expect(page.getByText('Produit test').first()).toBeVisible()

    // Filter by action type.
    await page.getByLabel('Toutes les actions').selectOption('movements_insert')
    await expect(page.getByText('movements_insert')).toBeVisible()
    await expect(page.getByText('products_insert')).not.toBeVisible()
  })
})

test.describe('Org settings - sync queue', () => {
  test('sync queue page loads and can cancel a dead operation', async ({ page }) => {
    await page.goto('/settings/sync-queue')

    await expect(page.getByRole('heading', { name: 'File de synchronisation' })).toBeVisible()
    await expect(
      page.getByText('Gérez les opérations en attente ou bloquées de l’organisation.')
    ).toBeVisible()

    // The seeded dead operation should appear.
    await expect(page.getByText('MOVEMENT')).toBeVisible()
    await expect(page.getByText('Bloqué')).toBeVisible()
    await expect(page.getByText('Stock insuffisant')).toBeVisible()

    // Open details dialog.
    await page.getByRole('button', { name: 'Détails' }).first().click()
    await expect(page.getByRole('dialog', { name: 'Détails de l’opération' })).toBeVisible()
    await expect(page.getByText('client_operation_id', { exact: false })).toBeVisible()
    // shadcn/ui Dialog renders a close button with an accessible name.
    await page.getByRole('button', { name: 'Close' }).click()

    // Cancel the operation.
    await page.getByRole('button', { name: 'Annuler' }).first().click()
    await expect(page.getByText('Opération MOVEMENT annulée')).toBeVisible()
    await expect(page.getByText('Annulé')).toBeVisible()
  })
})
