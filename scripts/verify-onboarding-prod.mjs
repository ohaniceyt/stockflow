#!/usr/bin/env node
// Read-only verification of the new onboarding endpoints in production.
// Uses only the existing verified test account; does not create orgs or users.

import { createClient } from '@supabase/supabase-js'

const PROJECT_REF = 'ngdvmodloxuvrdjjzxel'
const FUNCTIONS_BASE = `https://${PROJECT_REF}.supabase.co/functions/v1`
const ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZHZtb2Rsb3h1dnJkamp6eGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwODIwNzUsImV4cCI6MjA5NzY1ODA3NX0.b6RZ3zXPdBEnaQXTvNeAg_xB-pOzOGJF8lEKQ5SK5SU'

const EMAIL = process.env.SMOKE_EMAIL ?? ''
const PASSWORD = process.env.SMOKE_PASSWORD ?? ''

if (!EMAIL || !PASSWORD) {
  console.error(
    'Usage: SMOKE_EMAIL=<email> SMOKE_PASSWORD=<password> node scripts/verify-onboarding-prod.mjs'
  )
  process.exit(1)
}

const supabase = createClient(`https://${PROJECT_REF}.supabase.co`, ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function authedFetch(path, accessToken, body = undefined) {
  const res = await fetch(`${FUNCTIONS_BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text().catch(() => '')
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }
  return { ok: res.ok, status: res.status, body: parsed }
}

const results = []
function report(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✅' : '❌'} ${name}: ${detail}`)
}

let exitCode = 0
try {
  // 1. Login with the verified test account.
  const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD,
  })
  if (loginError) throw loginError
  const accessToken = loginData.session.access_token
  report('verified test account login', true, `user=${loginData.user.id}`)

  // 2. initialize-session returns expected onboarding fields.
  const init = await authedFetch('/initialize-session', accessToken)
  report(
    'initialize-session returns user object',
    init.ok && init.body?.user?.id,
    `status=${init.status}, userId=${init.body?.user?.id ?? 'missing'}`
  )
  report(
    'initialize-session returns needsOrganization boolean',
    init.ok && typeof init.body?.needsOrganization === 'boolean',
    `needsOrganization=${init.body?.needsOrganization}`
  )
  report(
    'initialize-session returns organization when onboarded',
    init.ok && init.body?.organization?.id && init.body?.membership?.orgId,
    `orgId=${init.body?.organization?.id ?? 'missing'}, membershipOrgId=${init.body?.membership?.orgId ?? 'missing'}`
  )

  // 3. complete-onboarding endpoint is reachable and validates bad input.
  const badSlug = await authedFetch('/complete-onboarding', accessToken, {
    orgName: 'x',
    orgSlug: 'x', // too short
    currency: 'XOF',
    timezone: 'Africa/Abidjan',
    defaultLocationName: 'Loc',
  })
  report(
    'complete-onboarding rejects invalid slug without crashing',
    !badSlug.ok && badSlug.status >= 400 && badSlug.status < 500,
    `status=${badSlug.status}, error=${JSON.stringify(badSlug.body).slice(0, 120)}`
  )

  // 4. complete-onboarding requires authentication.
  const noAuth = await fetch(`${FUNCTIONS_BASE}/complete-onboarding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({}),
  })
  report(
    'complete-onboarding rejects missing JWT',
    noAuth.status === 401,
    `status=${noAuth.status}`
  )

  const passed = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).length
  console.log('\n─────────────────────────────')
  console.log(`Onboarding verification result: ${passed} passed, ${failed} failed`)
  console.log('─────────────────────────────')
  if (failed > 0) exitCode = 1
} catch (err) {
  console.error(`\n❌ Verification aborted: ${err.message}`)
  exitCode = 1
}

process.exit(exitCode)
