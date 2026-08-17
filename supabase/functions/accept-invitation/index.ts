import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isNonEmptyString, isUuid } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  token?: unknown
  invitationId?: unknown
  name?: unknown
  password?: unknown
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

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const { token, invitationId, name, password } = parsed.body
    const hasToken = isNonEmptyString(token, 255)
    const hasInvitationId = isUuid(invitationId)

    if (!hasToken && !hasInvitationId) {
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

    if (hasToken) {
      query = query.eq('token', token as string)
    } else {
      query = query.eq('id', invitationId as string)
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
      const hasName = isNonEmptyString(name, 100)
      const hasPassword = isNonEmptyString(password, 128)
      if (!hasName || !hasPassword || (password as string).length < 8) {
        return new Response(
          JSON.stringify({ error: 'Name and a password of at least 8 characters are required' }),
          { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
        )
      }
      profileName = (name as string).trim()

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
        console.error('Failed to create auth user during invitation acceptance:', createAuthError)
        return genericInternalErrorResponse(req)
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
        console.error(
          'Failed to insert user profile during invitation acceptance:',
          insertProfileError
        )
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
        return genericInternalErrorResponse(req)
      }

      const { data: newMembership, error: insertError } = await adminClient
        .from('organization_memberships')
        .insert({
          org_id: invitation.org_id,
          user_id: authUserId,
          role: invitation.role,
          is_active: true,
          force_pin_change: false,
        })
        .select('id')
        .single()

      if (insertError || !newMembership) {
        console.error('Failed to create membership during invitation acceptance:', insertError)
        await adminClient.auth.admin.deleteUser(authUserId).catch(() => {})
        return genericInternalErrorResponse(req)
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
      console.error('Failed to create authenticated membership:', insertError)
      return genericInternalErrorResponse(req)
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
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
