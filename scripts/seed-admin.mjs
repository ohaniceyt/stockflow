import { createClient } from '@supabase/supabase-js'
import { pbkdf2Sync, randomBytes } from 'node:crypto'

const url = 'https://ngdvmodloxuvrdjjzxel.supabase.co'
const serviceKey = process.argv[2]
const password = process.env.PLATFORM_ADMIN_PASSWORD
const defaultPin = process.env.PLATFORM_ADMIN_PIN ?? '4242'

if (!serviceKey) {
  console.error('Usage: node scripts/seed-admin.mjs <SUPABASE_SERVICE_ROLE_KEY>')
  process.exit(1)
}

if (!password) {
  console.error('Environment variable PLATFORM_ADMIN_PASSWORD is required')
  process.exit(1)
}

if (password.length < 20) {
  console.error('PLATFORM_ADMIN_PASSWORD must be at least 20 characters')
  process.exit(1)
}

const adminClient = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const email = 'su@app.grandigix.com'

function hashPin(pin, salt = randomBytes(16)) {
  const derived = pbkdf2Sync(pin, salt, 100_000, 32, 'sha256')
  return `pbkdf2$${salt.toString('base64')}$${derived.toString('base64')}`
}

async function main() {
  const { data: list, error: listError } = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 100,
  })
  if (listError) throw listError

  let user = list.users.find((u) => u.email === email)

  if (!user) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: 'Platform Super Admin' },
    })
    if (error) throw error
    user = data.user
  } else {
    const { error } = await adminClient.auth.admin.updateUserById(user.id, { password })
    if (error) throw error
  }

  await adminClient.from('users').upsert({
    id: user.id,
    name: 'Platform Super Admin',
    email,
    email_verified: true,
    active_org_id: null,
  })

  const { data: firstOrg, error: orgError } = await adminClient
    .from('organizations')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (orgError || !firstOrg) throw new Error('No organization found')

  const pinHash = hashPin(defaultPin)

  const { data: existingMembership } = await adminClient
    .from('organization_memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('org_id', firstOrg.id)
    .maybeSingle()

  if (existingMembership) {
    const { error: updateError } = await adminClient
      .from('organization_memberships')
      .update({
        role: 'super_admin',
        pin_hash: pinHash,
        is_active: true,
        force_pin_change: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingMembership.id)
    if (updateError) throw updateError
  } else {
    const { error: insertError } = await adminClient.from('organization_memberships').insert({
      id: crypto.randomUUID(),
      user_id: user.id,
      org_id: firstOrg.id,
      role: 'super_admin',
      pin_hash: pinHash,
      is_active: true,
      force_pin_change: false,
    })
    if (insertError) throw insertError
  }

  await adminClient.from('users').update({ active_org_id: firstOrg.id }).eq('id', user.id)

  await adminClient.from('platform_admins').upsert({
    auth_user_id: user.id,
    email,
    name: 'Platform Super Admin',
    role: 'super_admin',
    is_active: true,
  })

  console.log('Done. User ID:', user.id, 'PIN:', defaultPin)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
