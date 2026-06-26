#!/usr/bin/env node
// Production smoke test for cashier receipt PDF/email flow.
// Requires SMOKE_EMAIL and SMOKE_PASSWORD env vars.

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
    'Usage: SMOKE_EMAIL=<email> SMOKE_PASSWORD=<password> node scripts/smoke-test-receipt.mjs'
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
let sessionId = ''
let receiptId = ''

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
  await check('Supabase Auth login', async () => {
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

  await check('initialize-session returns org', async () => `org=${orgId}`)

  if (!initBody.organization.onboardingCompleted) {
    await authedFetch('/complete-onboarding', {
      method: 'POST',
      body: JSON.stringify({
        orgName: `Smoke Receipt Org ${Date.now()}`,
        orgSlug: `smoke-receipt-${Date.now()}`,
        currency: 'XOF',
        timezone: 'Africa/Abidjan',
        defaultLocationName: 'Smoke Location',
      }),
    })
    const refreshed = await authedFetch('/initialize-session', { method: 'POST' })
    orgId = refreshed.body.membership.orgId
    locationId = refreshed.body.organization.defaultLocationId ?? ''
  } else {
    locationId = initBody.organization.defaultLocationId ?? ''
  }

  if (!locationId) {
    const { data: locs } = await supabase
      .from('locations')
      .select('id')
      .eq('org_id', orgId)
      .limit(1)
    locationId = locs?.[0]?.id ?? ''
  }

  const { body: product } = await authedFetch('/create-product', {
    method: 'POST',
    body: JSON.stringify({
      org_id: orgId,
      name: `Smoke Product ${Date.now()}`,
      unit: 'pièce',
      selling_price: 2000,
      is_active: true,
    }),
  })
  productId = product.id
  await check('create product for receipt', async () => `product=${productId}`)

  await authedFetch('/record-movement', {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      location_id: locationId,
      type: 'IN',
      quantity: 50,
      reason: 'Smoke stock in',
    }),
  })

  const { data: session } = await supabase
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
  sessionId = session.id
  await check('open cashier session', async () => `session=${sessionId}`)

  const { body: sale } = await authedFetch('/record-movement', {
    method: 'POST',
    body: JSON.stringify({
      product_id: productId,
      location_id: locationId,
      type: 'OUT',
      quantity: 1,
      unit_price: 2000,
      cashier_session_id: sessionId,
    }),
  })
  await check('record OUT sale', async () => `movement=${sale.movement_id}`)

  const { data: receipt, error: receiptError } = await supabase
    .from('receipts')
    .insert({
      org_id: orgId,
      location_id: locationId,
      cashier_session_id: sessionId,
      operator_id: initBody.user.id,
      document_number: `REC-${Date.now()}`,
      payment_method: 'cash',
      currency: 'XOF',
      subtotal: 2000,
      tax_amount: 0,
      total: 2000,
      amount_paid: 2000,
      change_due: 0,
    })
    .select('id')
    .single()
  if (receiptError) throw receiptError
  receiptId = receipt.id

  await supabase.from('receipt_items').insert({
    receipt_id: receiptId,
    product_id: productId,
    product_name: 'Smoke Product',
    quantity: 1,
    unit_price: 2000,
    discount_amount: 0,
    tax_amount: 0,
    total: 2000,
  })

  await check('create receipt with items', async () => `receipt=${receiptId}`)

  await check('generate receipt PDF', async () => {
    const { body } = await authedFetch('/generate-receipt-pdf', {
      method: 'POST',
      body: JSON.stringify({ receipt_id: receiptId }),
    })
    assert(body.pdf_base64, 'missing pdf_base64')
    return `filename=${body.filename}`
  })

  await check('send receipt email', async () => {
    const { body } = await authedFetch('/send-receipt-email', {
      method: 'POST',
      body: JSON.stringify({ receipt_id: receiptId, to: EMAIL }),
    })
    assert(body.success, 'email not sent')
    return `email_id=${body.email_id}`
  })

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log('\n─────────────────────────────')
  console.log(`Receipt smoke test result: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')
  if (failed > 0) process.exit(1)
} catch (err) {
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log('\n─────────────────────────────')
  console.log(`Receipt smoke test aborted: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')
  process.exit(1)
}
