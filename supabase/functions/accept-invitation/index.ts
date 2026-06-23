import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'

interface Payload {
  invitationId: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return encodeBase64(new Uint8Array(derived))
}

function generateTempPin(): string {
  const digits = '0123456789'
  let pin = ''
  for (let i = 0; i < 4; i++) {
    pin += digits[Math.floor(Math.random() * digits.length)]
  }
  return pin
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = parseJwt(token)
    if (!claims?.sub || !claims?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { invitationId }: Payload = await req.json()
    if (!invitationId) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: invitation, error: inviteError } = await adminClient
      .from('invitations')
      .select('id, org_id, email, role')
      .eq('id', invitationId)
      .eq('email', claims.email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found or already processed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check whether user already exists in target org
    const { data: existingOrgUser } = await adminClient
      .from('users')
      .select('id')
      .eq('org_id', invitation.org_id)
      .eq('email', invitation.email)
      .maybeSingle()

    if (existingOrgUser) {
      return new Response(JSON.stringify({ error: 'Already a member of this organization' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Look for an existing auth user with this email to reuse
    const { data: existingAuthUsers } = await adminClient.auth.admin.listUsers()
    const existingAuthUser = existingAuthUsers.users.find(
      (u) => u.email?.toLowerCase() === invitation.email.toLowerCase()
    )

    let authUserId = existingAuthUser?.id

    if (!authUserId) {
      const tempPassword = crypto.randomUUID()
      const { data: newAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser({
        email: invitation.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { org_id: invitation.org_id, role: invitation.role },
      })

      if (createAuthError || !newAuthUser.user) {
        return new Response(
          JSON.stringify({ error: createAuthError?.message ?? 'Could not create auth user' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      authUserId = newAuthUser.user.id
    }

    // Try to find source user info (name) from any org
    const { data: sourceUser } = await adminClient
      .from('users')
      .select('name')
      .eq('id', authUserId)
      .maybeSingle()

    const tempPin = generateTempPin()
    const salt = crypto.getRandomValues(new Uint8Array(16))
    const pinHash = `pbkdf2$${encodeBase64(salt)}$${await hashPin(tempPin, salt)}`

    const { error: insertError } = await adminClient.from('users').insert({
      id: authUserId,
      org_id: invitation.org_id,
      name: sourceUser?.name ?? invitation.email.split('@')[0],
      email: invitation.email,
      email_verified: true,
      role: invitation.role,
      pin_hash: pinHash,
      is_active: true,
      force_pin_change: true,
    })

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: updateError } = await adminClient
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        tempPin,
        message:
          'Invitation accepted. Use the temporary PIN to log in; you will be prompted to set a permanent PIN.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
