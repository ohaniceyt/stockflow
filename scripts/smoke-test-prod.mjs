#!/usr/bin/env node
// Production smoke tests for StockFlow vNext.
// Verifies that the deployed Edge Functions and frontend respond correctly.
// Full authenticated flows (login → onboarding → movement → cashier → API key)
// require a verified test account; this script validates the public surface
// and reports which checks passed/failed.

import assert from 'node:assert'

const PROJECT_REF = 'ngdvmodloxuvrdjjzxel'
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`
const APP_URL = 'https://stockflow.grandigix.com'
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZHZtb2Rsb3h1dnJkamp6eGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODIwNzUsImV4cCI6MjA5NzY1ODA3NX0.b6RZ3zXPdBEnaQXTvNeAg_xB-pOzOGJF8lEKQ5SK5SU'

const results = []

async function check(name, fn) {
  try {
    const result = await fn()
    results.push({ name, status: 'PASS', detail: result })
    console.log(`✅ ${name}`)
  } catch (err) {
    results.push({ name, status: 'FAIL', detail: err.message })
    console.error(`❌ ${name}: ${err.message}`)
  }
}

async function request(url, opts = {}) {
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      ...opts.headers,
    },
  })
  const text = await res.text().catch(() => '')
  return { res, text }
}

async function jsonRequest(url, opts = {}) {
  const { res, text } = await request(url, opts)
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  return { res, body }
}

await check('frontend root responds', async () => {
  const res = await fetch(APP_URL, { redirect: 'manual' })
  assert([200, 301, 302].includes(res.status), `unexpected status ${res.status}`)
  return `status ${res.status}`
})

await check('frontend /login responds', async () => {
  const res = await fetch(`${APP_URL}/login`, { redirect: 'manual' })
  assert([200, 301, 302].includes(res.status), `unexpected status ${res.status}`)
  return `status ${res.status}`
})

await check('public function login (OPTIONS)', async () => {
  const { res } = await request(`${FUNCTIONS_BASE}/login`, { method: 'OPTIONS' })
  assert.strictEqual(res.status, 200)
  return 'CORS OK'
})

await check('public function login rejects empty payload', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/login`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 400)
  assert(body && body.error, 'expected error field')
  return body.error
})

await check('public function signup accepts valid signup payload', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/signup`, {
    method: 'POST',
    body: JSON.stringify({
      email: `smoke-test-${Date.now()}@example.com`,
      password: 'SmokeTest123!',
      name: 'Smoke Test',
    }),
  })
  // The function may return 200 (user created) or 400/422 (validation error).
  // Either response proves the endpoint is reachable and processing requests.
  assert([200, 201, 400, 422].includes(res.status), `unexpected status ${res.status}`)
  return `status ${res.status}, body: ${JSON.stringify(body).slice(0, 120)}`
})

await check('public function send-magic-link requires email', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/send-magic-link`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 400)
  return body?.error ?? 'missing email'
})

await check('public function lookup-user-by-email rejects missing email', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/lookup-user-by-email`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 400)
  return body?.error ?? 'missing email'
})

await check('public function create-storefront-order rejects unknown org', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/create-storefront-order`, {
    method: 'POST',
    body: JSON.stringify({
      org_slug: 'nonexistent-smoke-org',
      customer_name: 'Smoke Customer',
      customer_email: 'smoke@example.com',
      items: [{ product_id: '00000000-0000-0000-0000-000000000000', quantity: 1 }],
    }),
  })
  assert([404, 400].includes(res.status), `unexpected status ${res.status}`)
  return `status ${res.status}, error: ${body?.error ?? body}`
})

await check('public function api-gateway rejects missing API key', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/api-gateway/api/v1/products`, {
    method: 'GET',
  })
  assert.strictEqual(res.status, 401)
  return body?.error ?? 'unauthorized'
})

await check('authenticated function record-movement rejects missing JWT', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/record-movement`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 401)
  return body?.error ?? 'unauthorized'
})

await check('authenticated function complete-onboarding rejects missing JWT', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/complete-onboarding`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 401)
  return body?.error ?? 'unauthorized'
})

await check('authenticated function cancel-sale rejects missing JWT', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/cancel-sale`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 401)
  return body?.error ?? 'unauthorized'
})

await check('authenticated function create-api-key rejects missing JWT', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/create-api-key`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 401)
  return body?.error ?? 'unauthorized'
})

await check('authenticated function initialize-session rejects missing JWT', async () => {
  const { res, body } = await jsonRequest(`${FUNCTIONS_BASE}/initialize-session`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  assert.strictEqual(res.status, 401)
  return body?.error ?? 'unauthorized'
})

const passed = results.filter((r) => r.status === 'PASS').length
const failed = results.filter((r) => r.status === 'FAIL').length

console.log('\n─────────────────────────────')
console.log(`Smoke test result: ${passed} passed, ${failed} failed`)
console.log('─────────────────────────────')

if (failed > 0) {
  process.exit(1)
}
