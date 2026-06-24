import { createClient } from '@supabase/supabase-js'

const url = 'https://ngdvmodloxuvrdjjzxel.supabase.co'
const publishableKey = 'sb_publishable_vdrn0CrixTpyQ0teLhMwlQ_YnnjRdvH'
const email = 'su@app.grandigix.com'
const password = 'AdminPass123!'

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
