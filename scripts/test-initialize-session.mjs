import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const publishableKey = process.env.SUPABASE_ANON_KEY
const email = process.env.PLATFORM_ADMIN_EMAIL
const password = process.env.PLATFORM_ADMIN_PASSWORD

if (!url || !publishableKey || !email || !password) {
  console.error(
    'Missing required environment variables: SUPABASE_URL, SUPABASE_ANON_KEY, PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD'
  )
  process.exit(1)
}

const supabase = createClient(url, publishableKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('Login error:', error)
    return
  }

  console.log('Access token:', data.session.access_token.slice(0, 20) + '...')

  const res = await fetch(`${url}/functions/v1/initialize-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: publishableKey,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  })

  const json = await res.json()
  console.log('Status:', res.status)
  console.log('Response:', JSON.stringify(json, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
