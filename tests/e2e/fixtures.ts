/* eslint-disable react-hooks/rules-of-hooks */
import { test as base, expect } from '@playwright/test'
import { injectMockSession } from './helpers/auth'
import { setupMockBackend } from './helpers/mockBackend'

export const test = base.extend({
  page: async ({ page }, use) => {
    await setupMockBackend(page)
    await injectMockSession(page)
    await use(page)
  },
})

export { expect }
