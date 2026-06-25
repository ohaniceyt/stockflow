#!/usr/bin/env node
// Authenticated production smoke test for StockFlow vNext.
// Runs a full functional flow: login → initialize-session → create org data
// → record movement → cashier sale → storefront order → API key order.
// Requires a verified production test account.

import assert from 'node:assert'
import { createClient } from '@supabase/supabase-js'

const PROJECT_REF = 'ngdvmodloxuvrdjjzxel'
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZHZtb2Rsb3h1dnJkamp6eGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODIwNzUsImV4cCI6MjA5NzY1ODA3NX0.b6RZ3zXPdBEnaQXTvNeAg_xB-pOzOGJF8lEKQ5SK5SU'

const EMAIL = process.env.SMOKE_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error(
    'Usage: SMOKE_EMAIL=<email> SMOKE_PASSWORD=<password> node scripts/smoke-test-prod-authenticated.mjs'
  )
  process.exit(1)
}

const supabase = createClient(`https://${PROJECT_REF}.supabase.co`, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
let accessToken = ''
let orgId = ''
let locationId = ''
let productId = ''
let apiKey = ''
let storefrontSlug = ''

async function check(name, fn) {
  try {
    const detail = await fn()
    results.push({ name, status: 'PASS', detail })
    console.log(`✅ ${name}`)
    return detail
  } catch (err) {
    results.push({ name, status: 'FAIL', detail: err.message })
    console.error(`❌ ${name}: ${err.message}`)
    throw err
  }
}

async function authedFetch(path, opts = {}) {
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      ...opts.headers,
    },
  })
  const text = await res.text().catch(() => '')
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`${res.status}: ${JSON.stringify(body).slice(0, 200)}`)
  }
  return { res, body }
}

try {
  await check('Supabase Auth login with email/password', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD,
    })
    if (error) throw error
    accessToken = data.session.access_token
    return `user=${data.user.id}`
  })

  const initResponse = await authedFetch('/initialize-session', { method: 'POST' })
  const initBody = initResponse.body
  assert(initBody.user, 'missing user')
  assert(initBody.membership, 'missing membership')
  assert(initBody.organization, 'missing organization')
  orgId = initBody.membership.orgId
  storefrontSlug = initBody.organization.slug ?? ''

  await check('initialize-session returns org and membership', async () => {
    return `org=${orgId}, role=${initBody.membership.role}`
  })

  // If onboarding is not completed, automatically run complete-onboarding.
  if (!initBody.organization.onboardingCompleted) {
    await check('complete onboarding', async () => {
      const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
      const slug = `smoke-org-${suffix}`
      const orgName = `Smoke Test Org ${suffix}`
      const { body } = await authedFetch('/complete-onboarding', {
        method: 'POST',
        body: JSON.stringify({
          orgName,
          orgSlug: slug,
          currency: 'XOF',
          timezone: 'Africa/Abidjan',
          defaultLocationName: 'Smoke Location',
        }),
      })
      assert(body.organization, 'missing organization')
      assert(body.membership, 'missing membership')
      orgId = body.organization.id
      storefrontSlug = body.organization.slug
      locationId = body.location?.id ?? ''
      return `org=${orgId}, slug=${storefrontSlug}, location=${locationId}`
    })
  } else {
    orgId = initBody.membership.orgId
    storefrontSlug = initBody.organization.slug ?? ''
  }

  // Ensure we have a location id for subsequent operations.
  if (!locationId) {
    await check('list locations for org', async () => {
      const { data, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('org_id', orgId)
        .limit(1)
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('No location found. Create a location first.')
      }
      locationId = data[0].id
      return `location=${locationId}`
    })
  }

  const productBody = await check('create product', async () => {
    const name = `Smoke Product ${Date.now()}`
    const { body } = await authedFetch('/create-product', {
      method: 'POST',
      body: JSON.stringify({
        org_id: orgId,
        name,
        unit: 'pièce',
        threshold: 5,
        cost_price: 1000,
        selling_price: 1500,
        is_active: true,
      }),
    })
    assert(body.id, 'missing product id')
    productId = body.id
    return `product=${productId}`
  })

  await check('record IN movement', async () => {
    const { body } = await authedFetch('/record-movement', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        location_id: locationId,
        type: 'IN',
        quantity: 100,
        reason: 'Smoke test stock in',
      }),
    })
    assert(body.movement_id, 'missing movement id')
    return `movement=${body.movement_id}`
  })

  const { data: cashierSessionData, error: cashierSessionError } = await supabase
    .from('cashier_sessions')
    .insert({
      org_id: orgId,
      location_id: locationId,
      operator_id: initBody.user.id,
      opening_balance: 0,
      status: 'open',
    })
    .select('id')
    .single()
  if (cashierSessionError) throw cashierSessionError
  const cashierSessionId = cashierSessionData.id

  await check('open cashier session', async () => {
    return `session=${cashierSessionId}`
  })

  await check('record OUT sale via cashier session', async () => {
    const { body } = await authedFetch('/record-movement', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        location_id: locationId,
        type: 'OUT',
        quantity: 1,
        unit_price: 1500,
        cashier_session_id: cashierSessionId,
      }),
    })
    assert(body.movement_id, 'missing movement id')
    return `sale=${body.movement_id}`
  })

  await check('create storefront order', async () => {
    if (!storefrontSlug) throw new Error('No org slug for storefront')
    const { body } = await fetch(`${FUNCTIONS_BASE}/create-storefront-order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        org_slug: storefrontSlug,
        customer_name: 'Smoke Storefront Customer',
        customer_email: `smoke-storefront-${Date.now()}@example.com`,
        items: [{ product_id: productId, quantity: 1 }],
      }),
    }).then(async (res) => {
      const text = await res.text().catch(() => '')
      let b = null
      try {
        b = text ? JSON.parse(text) : null
      } catch {
        b = text
      }
      if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(b).slice(0, 200)}`)
      return { res, body: b }
    })
    assert(body.order_id, 'missing order id')
    return `order=${body.order_id}`
  })

  const keyRecord = await check('create API key', async () => {
    const { body } = await authedFetch('/create-api-key', {
      method: 'POST',
      body: JSON.stringify({
        org_id: orgId,
        name: 'Smoke API Key',
        scopes: ['read:products', 'write:orders'],
      }),
    })
    assert(body.api_key, 'missing api key')
    apiKey = body.api_key
    return `key_id=${body.id}`
  })

  await check('place order via API gateway', async () => {
    const res = await fetch(`${FUNCTIONS_BASE}/api-gateway/api/v1/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-StockFlow-API-Key': apiKey,
        apikey: ANON_KEY,
      },
      body: JSON.stringify({
        customer_name: 'Smoke API Customer',
        customer_email: `smoke-api-${Date.now()}@example.com`,
        location_id: locationId,
        items: [{ product_id: productId, quantity: 1 }],
      }),
    })
    const text = await res.text().catch(() => '')
    let b = null
    try {
      b = text ? JSON.parse(text) : null
    } catch {
      b = text
    }
    if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(b).slice(0, 200)}`)
    assert(b.order_id, 'missing api order id')
    return `order=${b.order_id}`
  })

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log('\n─────────────────────────────')
  console.log(`Authenticated smoke test result: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')

  if (failed > 0) {
    process.exit(1)
  }
} catch (err) {
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log('\n─────────────────────────────')
  console.log(`Authenticated smoke test aborted: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')
  process.exit(1)
}
