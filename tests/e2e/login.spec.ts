import { test, expect } from '@playwright/test'

const DEMO_EMAIL = 'alice@example.com'
const DEMO_USER_ID = '00000000-0000-0000-0000-000000000001'
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000010'
const DEMO_USER_NAME = 'Alice Admin'
const DEMO_PIN = '1234'

test('login page is accessible', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/StockFlow/)
  await expect(page.getByLabel('Adresse email')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeVisible()
})

test('valid PIN requests magic link', async ({ page }) => {
  // Stub the public lookup endpoint used by the email-first login flow.
  await page.route('**/functions/v1/lookup-user-by-email', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        userId: DEMO_USER_ID,
        name: DEMO_USER_NAME,
        role: 'super_admin',
        orgId: DEMO_ORG_ID,
      }),
    })
  })

  // Stub the login endpoint (PIN check) and the magic-link sender.
  await page.route('**/functions/v1/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: DEMO_EMAIL,
        forcePinChange: false,
        onboardingCompleted: true,
        user: {
          id: DEMO_USER_ID,
          orgId: DEMO_ORG_ID,
          name: DEMO_USER_NAME,
          email: DEMO_EMAIL,
          emailVerified: true,
          role: 'super_admin',
          forcePinChange: false,
          onboardingCompleted: true,
        },
      }),
    })
  })
  await page.route('**/functions/v1/send-magic-link', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, emailId: 'test-email-id' }),
    })
  })

  await page.goto('/login')

  await page.getByLabel('Adresse email').fill(DEMO_EMAIL)
  await page.getByRole('button', { name: 'Continuer' }).click()

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
  await page.route('**/functions/v1/lookup-user-by-email', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        found: true,
        userId: DEMO_USER_ID,
        name: DEMO_USER_NAME,
        role: 'super_admin',
        orgId: DEMO_ORG_ID,
      }),
    })
  })

  await page.route('**/functions/v1/login', async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'PIN incorrect' }),
    })
  })

  await page.goto('/login')

  await page.getByLabel('Adresse email').fill(DEMO_EMAIL)
  await page.getByRole('button', { name: 'Continuer' }).click()

  await expect(page.getByText(`Bonjour, ${DEMO_USER_NAME.split(' ')[0]}`)).toBeVisible()

  for (const digit of '0000') {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  await expect(page.getByText(/Échec de la connexion|PIN incorrect/)).toBeVisible()
})
