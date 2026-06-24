import { test, expect } from '@playwright/test'
import { test as authTest } from './fixtures'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

const DEMO_USER = {
  email: 'alice@example.com',
  password: 'MyPassword123!',
  name: 'Alice Admin',
}

test('login page is accessible', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)
  await expect(page).toHaveTitle(/StockFlow/)
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Mot de passe')).toBeVisible()
  await expect(page.getByRole('button', { name: /Se connecter/ })).toBeVisible()
})

authTest('successful login redirects to dashboard', async ({ page }) => {
  await page.goto(`${BASE_URL}/dashboard`)
  await expect(page.getByText('Tableau de bord').first()).toBeVisible()
})

test('invalid credentials show error', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`)

  await page.getByLabel('Email').fill(DEMO_USER.email)
  await page.getByLabel('Mot de passe').fill('wrong-password')
  await page.getByRole('button', { name: /Se connecter/ }).click()

  await expect(
    page.getByText(/Échec de la connexion|Identifiants invalides|Invalid login credentials/)
  ).toBeVisible()
})
