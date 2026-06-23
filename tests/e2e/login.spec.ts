import { test, expect } from '@playwright/test'

const DEMO_USER_NAME = 'Alice Admin'
const DEMO_PIN = '1234'

test('login page is accessible', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/StockFlow/)
  await expect(page.getByText('Sélectionnez votre profil puis saisissez votre PIN')).toBeVisible()
})

test('valid PIN requests magic link', async ({ page }) => {
  // Stub the public send-magic-link Edge Function so the test does not depend
  // on a real email provider or hit rate limits.
  await page.route('**/functions/v1/send-magic-link', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, emailId: 'test-email-id' }),
    })
  })

  await page.goto('/login')

  await page.getByRole('button', { name: DEMO_USER_NAME }).click()
  await expect(page.getByText(`Bonjour, ${DEMO_USER_NAME.split(' ')[0]}`)).toBeVisible()

  // Enter 4-digit PIN via numeric buttons
  for (const digit of DEMO_PIN) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  // The app now sends a magic link and asks the user to check their email.
  await expect(page.getByText('Vérifiez votre email')).toBeVisible()
  await expect(page.getByText(/Un lien de connexion sécurisé a été envoyé/)).toBeVisible()
})

test('invalid PIN shows error', async ({ page }) => {
  // Stub the login Edge Function to return an authentication error so the test
  // does not depend on backend state or rate limits.
  await page.route('**/functions/v1/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'PIN incorrect' }),
    })
  })

  await page.goto('/login')

  await page.getByRole('button', { name: DEMO_USER_NAME }).click()

  for (const digit of '0000') {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  await expect(page.getByText(/Échec de la connexion|PIN incorrect/)).toBeVisible()
})
