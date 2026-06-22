import { test, expect } from '@playwright/test'

const DEMO_USER_NAME = 'Alice Admin'
const DEMO_PIN = '1234'

test('login page is accessible', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/StockFlow/)
  await expect(page.getByText('Sélectionnez votre profil puis saisissez votre PIN')).toBeVisible()
})

test('demo bypass logs in with PIN', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('button', { name: DEMO_USER_NAME }).click()
  await expect(page.getByText(`Bonjour, ${DEMO_USER_NAME.split(' ')[0]}`)).toBeVisible()

  // Enter 4-digit PIN via numeric buttons
  for (const digit of DEMO_PIN) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  // Wait for dashboard navigation after bypass sign-in
  await expect(page).toHaveURL('/')
  await expect(page.getByText('Tableau de bord')).toBeVisible()
  await expect(page.getByText(DEMO_USER_NAME)).toBeVisible()
})

test('invalid PIN shows error', async ({ page }) => {
  await page.goto('/login')

  await page.getByRole('button', { name: DEMO_USER_NAME }).click()

  for (const digit of '0000') {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  await expect(page.getByText(/PIN incorrect|Invalid PIN/)).toBeVisible()
})
