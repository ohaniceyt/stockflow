import { test, expect } from '@playwright/test'

test('login page is accessible', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/StockFlow/)
  await expect(page.getByText('Connexion par PIN')).toBeVisible()
})
