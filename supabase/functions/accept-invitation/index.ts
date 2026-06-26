import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface NewUserPayload {
  token: string
  name: string
  password: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase env vars')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const payload = await req.json()
    const token = (payload as { token?: string }).token
    const invitationId = (payload as { invitationId?: string }).invitationId

    if (!token && !invitationId) {
      return new Response(JSON.stringify({ error: 'Token or invitationId required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Load invitation
    let query = adminClient
      .from('invitations')
      .select('id, org_id, email, role, expires_at, status, name')
      .eq('status', 'pending')

    if (token) {
      query = query.eq('token', token)
    } else {
      query = query.eq('id', invitationId)
    }

    const { data: invitation, error: inviteError } = await query.single()

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found or already processed' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (invitation.expires_at && new Date(invitation.expires_at as string) < new Date()) {
      return new Response(JSON.stringify({ error: 'Invitation expired' }), {
        status: 410,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const normalizedEmail = (invitation.email as string).toLowerCase()

    // Check whether a membership already exists in target org
    const { data: existingProfile } = await adminClient
      .from('users')
      .select('id, name')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (existingProfile) {
      const { data: existingMembership } = await adminClient
        .from('organization_memberships')
        .select('id')
        .eq('org_id', invitation.org_id)
        .eq('user_id', existingProfile.id)
        .maybeSingle()

      if (existingMembership) {
        return new Response(JSON.stringify({ error: 'Already a member of this organization' }), {
          status: 409,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
    }

    const bearerToken = getBearerToken(req)
    const claims = bearerToken ? await verifyToken(supabaseUrl, anonKey, bearerToken) : null
    const isAuthenticated = !!claims?.sub && !!claims?.email

    let authUserId: string | null = null
    let profileName: string | null = null

    if (isAuthenticated) {
      // Authenticated acceptance: email must match the invitation.
      const claimEmail = claims.email?.toLowerCase()
      if (!claimEmail || claimEmail !== normalizedEmail) {
        return new Response(
          JSON.stringify({ error: 'Invitation email does not match signed-in user' }),
          { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }
      authUserId = claims.sub

      if (!existingProfile) {
        return new Response(JSON.stringify({ error: 'Authenticated user profile not found' }), {
          status: 404,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      profileName = existingProfile.name
    } else {
      // New-user acceptance: name and password are required.
      const { name, password } = payload as NewUserPayload
      if (!name?.trim() || !password || (password as string).length < 8) {
        return new Response(
          JSON.stringify({ error: 'Name and a password of at least 8 characters are required' }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }
      profileName = name.trim()

      // Refuse if a profile already exists for this email (user should log in first).
      if (existingProfile) {
        return new Response(
          JSON.stringify({
            error:
              'An account already exists for this email. Please log in to accept the invitation.',
            existingAccount: true,
          }),
          { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      // Create auth user. The invitation link came from the email, so we trust it.
      const { data: newAuthUser, error: createAuthError } = await adminClient.auth.admin.createUser(
        {
          email: normalizedEmail,
          password: password as string,
          email_confirm: true,
          user_metadata: { name: profileName },
        }
      )

      if (createAuthError || !newAuthUser.user) {
        return new Response(
          JSON.stringify({ error: createAuthError?.message ?? 'Could not create auth user' }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }
      authUserId = newAuthUser.user.id

      // Create global profile
      const { error: insertProfileError } = await adminClient.from('users').insert({
        id: authUserId,
        name: profileName,
        email: normalizedEmail,
        email_verified: true,
        active_org_id: invitation.org_id,
      })

      if (insertProfileError) {
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
        return new Response(JSON.stringify({ error: insertProfileError.message }), {
          status: 500,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }

      const { data: newMembership, error: insertError } = await adminClient
        .from('organization_memberships')
        .insert({
          org_id: invitation.org_id,
          user_id: authUserId,
          role: invitation.role,
          pin_hash: null,
          is_active: true,
          force_pin_change: false,
        })
        .select('id')
        .single()

      if (insertError || !newMembership) {
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
        return new Response(
          JSON.stringify({ error: insertError?.message ?? 'Could not create membership' }),
          { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }

      await adminClient.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)

      return new Response(
        JSON.stringify({
          success: true,
          membershipId: newMembership.id,
          message: 'Invitation accepted. You can now log in.',
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Authenticated path: create membership for existing user.
    const { data: newMembership, error: insertError } = await adminClient
      .from('organization_memberships')
      .insert({
        org_id: invitation.org_id,
        user_id: authUserId,
        role: invitation.role,
        pin_hash: null,
        is_active: true,
        force_pin_change: false,
      })
      .select('id')
      .single()

    if (insertError || !newMembership) {
      return new Response(
        JSON.stringify({ error: insertError?.message ?? 'Could not create membership' }),
        { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    await adminClient
      .from('users')
      .update({ active_org_id: invitation.org_id })
      .eq('id', authUserId)

    await adminClient.from('invitations').update({ status: 'accepted' }).eq('id', invitation.id)

    return new Response(
      JSON.stringify({
        success: true,
        membershipId: newMembership.id,
        message: 'Invitation accepted. You can now access the organization.',
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
