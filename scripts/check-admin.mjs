import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const email = process.env.PLATFORM_ADMIN_EMAIL

if (!url || !serviceKey || !email) {
  console.error(
    'Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PLATFORM_ADMIN_EMAIL'
  )
  process.exit(1)
}

const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const { data: list, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  })
  if (listError) throw listError
  const user = list.users.find((u) => u.email === email)
  console.log('Auth user:', user)

  const { data: platformAdmin } = await adminClient
    .from('platform_admins')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  console.log('Platform admin:', platformAdmin)

  const { data: memberships } = await adminClient
    .from('organization_memberships')
    .select('*')
    .eq('user_id', user?.id)
  console.log('Memberships:', memberships)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
