#!/usr/bin/env node
// Production smoke test for the quote → invoice → payment → delivery note lifecycle.
// Requires a verified production test account with an accessible email inbox.

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
    'Usage: SMOKE_EMAIL=<email> SMOKE_PASSWORD=<password> node scripts/smoke-test-invoicing.mjs'
  )
  process.exit(1)
}

const supabase = createClient(`https://${PROJECT_REF}.supabase.co`, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const results = []
let accessToken = ''
let orgId = ''
let contactId = ''
let quoteId = ''
let invoiceId = ''
let deliveryNoteId = ''

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

function uniqueDocNum(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

try {
  await check('Supabase Auth login with email/password', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
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

  await check('initialize-session returns org and membership', async () => {
    return `org=${orgId}, role=${initBody.membership.role}`
  })

  const contactEmail = `smoke-customer-${Date.now()}@example.com`
  const contactResponse = await authedFetch('/create-contact', {
    method: 'POST',
    body: JSON.stringify({
      org_id: orgId,
      type: 'CUSTOMER',
      name: `Smoke Customer ${Date.now()}`,
      email: contactEmail,
    }),
  })
  contactId = contactResponse.body.id
  await check('create customer contact', async () => {
    return `contact=${contactId}`
  })

  const quoteNumber = uniqueDocNum('Q')
  const quoteTotal = 15000
  const { data: quoteData, error: quoteError } = await supabase
    .from('invoices')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      type: 'quote',
      document_number: quoteNumber,
      status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      currency: 'XOF',
      subtotal: quoteTotal,
      tax_total: 0,
      total: quoteTotal,
      note: 'Smoke test quote',
    })
    .select('id')
    .single()
  if (quoteError) throw quoteError
  quoteId = quoteData.id

  const { error: itemsError } = await supabase.from('invoice_items').insert({
    invoice_id: quoteId,
    description: 'Smoke service line',
    quantity: 1,
    unit_price: quoteTotal,
    tax_rate: 0,
    discount_amount: 0,
    total: quoteTotal,
  })
  if (itemsError) throw itemsError

  await check('create quote with items', async () => {
    return `quote=${quoteId}, total=${quoteTotal}`
  })

  const { data: invoiceData, error: convertError } = await supabase.rpc('convert_quote_to_invoice', {
    p_quote_id: quoteId,
  })
  if (convertError) throw convertError
  invoiceId = invoiceData

  await check('convert quote to invoice', async () => {
    return `invoice=${invoiceId}`
  })

  await check('verify quote was marked converted', async () => {
    const { data, error } = await supabase.from('invoices').select('status, converted_to_invoice_id').eq('id', quoteId).single()
    if (error) throw error
    assert(data.status === 'converted', `expected converted, got ${data.status}`)
    assert(data.converted_to_invoice_id === invoiceId, 'converted_to_invoice_id mismatch')
    return `status=${data.status}`
  })

  await check('generate PDF for quote', async () => {
    const { body } = await authedFetch('/generate-document-pdf', {
      method: 'POST',
      body: JSON.stringify({ document_id: quoteId, type: 'quote' }),
    })
    assert(body.pdf_base64, 'missing pdf_base64')
    assert(body.pdf_base64.length > 100, 'pdf too small')
    return `filename=${body.filename}, bytes=${Math.ceil(body.pdf_base64.length * 0.75)}`
  })

  await check('generate PDF for invoice', async () => {
    const { body } = await authedFetch('/generate-document-pdf', {
      method: 'POST',
      body: JSON.stringify({ document_id: invoiceId, type: 'invoice' }),
    })
    assert(body.pdf_base64, 'missing pdf_base64')
    return `filename=${body.filename}`
  })

  await check('send invoice email', async () => {
    const { body } = await authedFetch('/send-document-email', {
      method: 'POST',
      body: JSON.stringify({ document_id: invoiceId, type: 'invoice', to: EMAIL }),
    })
    assert(body.success, 'email not sent')
    return `email_id=${body.email_id}`
  })

  await check('send invoice reminder', async () => {
    const { body } = await authedFetch('/send-invoice-reminder', {
      method: 'POST',
      body: JSON.stringify({ invoice_id: invoiceId, to: EMAIL }),
    })
    assert(body.success, 'reminder not sent')
    return `reminder_email_id=${body.email_id}`
  })

  const { data: paymentData, error: paymentError } = await supabase.rpc('record_invoice_payment', {
    p_invoice_id: invoiceId,
    p_amount: quoteTotal,
    p_payment_method: 'cash',
    p_reference: 'smoke-test',
  })
  if (paymentError) throw new Error(paymentError.message ?? JSON.stringify(paymentError))

  await check('record full invoice payment', async () => {
    return `payment=${paymentData}`
  })

  await check('verify invoice paid after payment trigger', async () => {
    const { data, error } = await supabase.from('invoices').select('status, paid_amount').eq('id', invoiceId).single()
    if (error) throw error
    assert(data.status === 'paid', `expected paid, got ${data.status}`)
    assert(Number(data.paid_amount) === quoteTotal, `paid_amount mismatch: ${data.paid_amount}`)
    return `status=${data.status}, paid=${data.paid_amount}`
  })

  const deliveryNoteNumber = uniqueDocNum('BL')
  const { data: dnData, error: dnError } = await supabase
    .from('invoices')
    .insert({
      org_id: orgId,
      contact_id: contactId,
      type: 'delivery_note',
      document_number: deliveryNoteNumber,
      status: 'draft',
      issue_date: new Date().toISOString().slice(0, 10),
      due_date: null,
      currency: 'XOF',
      subtotal: quoteTotal,
      tax_total: 0,
      total: quoteTotal,
      delivery_address: 'Smoke delivery address',
      note: 'Smoke test delivery note',
    })
    .select('id')
    .single()
  if (dnError) throw dnError
  deliveryNoteId = dnData.id

  const { error: dnItemsError } = await supabase.from('invoice_items').insert({
    invoice_id: deliveryNoteId,
    description: 'Smoke delivered item',
    quantity: 1,
    unit_price: quoteTotal,
    tax_rate: 0,
    discount_amount: 0,
    total: quoteTotal,
  })
  if (dnItemsError) throw dnItemsError

  await check('create delivery note with items', async () => {
    return `delivery_note=${deliveryNoteId}`
  })

  await check('generate PDF for delivery note', async () => {
    const { body } = await authedFetch('/generate-document-pdf', {
      method: 'POST',
      body: JSON.stringify({ document_id: deliveryNoteId, type: 'delivery_note' }),
    })
    assert(body.pdf_base64, 'missing pdf_base64')
    return `filename=${body.filename}`
  })

  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length

  console.log('\n─────────────────────────────')
  console.log(`Invoicing smoke test result: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')

  if (failed > 0) {
    process.exit(1)
  }
} catch (err) {
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  console.log('\n─────────────────────────────')
  console.log(`Invoicing smoke test aborted: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')
  process.exit(1)
}
