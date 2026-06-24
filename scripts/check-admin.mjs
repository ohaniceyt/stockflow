import { createClient } from '@supabase/supabase-js'

const url = 'https://ngdvmodloxuvrdjjzxel.supabase.co'
const serviceKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZHZtb2Rsb3h1dnJkamp6eGVsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MjA4MjA3NSwiZXhwIjoyMDk3NjU4MDc1fQ.NdfKRG-1OOSdNogBma00E5wkfU4WHikFDfXzjCH-Isc'

const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const email = 'su@app.grandigix.com'
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
