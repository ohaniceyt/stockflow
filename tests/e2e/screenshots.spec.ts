import { test as authTest, expect } from './fixtures'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

authTest.describe('landing page screenshots', () => {
  authTest('capture dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/dashboard`)
    await expect(page.getByText('Tableau de bord').first()).toBeVisible()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'public/dashboard-preview.png', fullPage: false })
  })

  authTest('capture cashier', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/cashier`)
    await expect(page.getByText('Caisse').first()).toBeVisible()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'public/features/pos-preview.png', fullPage: false })
  })

  authTest('capture stock', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(`${BASE_URL}/stock`)
    await expect(page.getByText('Stock').first()).toBeVisible()
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'public/features/inventory-preview.png', fullPage: false })
  })
})
