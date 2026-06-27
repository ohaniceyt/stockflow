import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

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

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const authUserId = claims.sub

    // Sync email verification status from auth.users
    const { data: authUser, error: authUserError } =
      await adminClient.auth.admin.getUserById(authUserId)
    if (authUserError || !authUser.user) {
      return new Response(JSON.stringify({ error: 'User not found in auth' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const emailVerified = authUser.user.email_confirmed_at != null
    const normalizedEmail = (authUser.user.email ?? '').toLowerCase()

    // Load or create global profile
    let { data: profile } = await adminClient
      .from('users')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle()

    if (!profile) {
      const metadataName = authUser.user.user_metadata?.name ?? ''
      const metadataPhone = authUser.user.user_metadata?.phone ?? null
      const { data: newProfile, error: createError } = await adminClient
        .from('users')
        .insert({
          id: authUserId,
          name: metadataName,
          email: normalizedEmail,
          phone: metadataPhone,
          email_verified: emailVerified,
          active_org_id: null,
        })
        .select('*')
        .single()

      if (createError || !newProfile) {
        return new Response(
          JSON.stringify({ error: createError?.message ?? 'Could not create profile' }),
          {
            status: 500,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        )
      }
      profile = newProfile
    }

    if (profile.email_verified !== emailVerified) {
      await adminClient.from('users').update({ email_verified: emailVerified }).eq('id', authUserId)
      profile.email_verified = emailVerified
    }

    // Determine active org/membership
    let activeOrgId = profile.active_org_id as string | null
    if (!activeOrgId) {
      const { data: firstMembership } = await adminClient
        .from('organization_memberships')
        .select('org_id')
        .eq('user_id', authUserId)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (firstMembership) {
        activeOrgId = firstMembership.org_id
        await adminClient.from('users').update({ active_org_id: activeOrgId }).eq('id', authUserId)
      }
    }

    // No organization yet: return a shell session so the frontend can redirect to onboarding.
    if (!activeOrgId) {
      return new Response(
        JSON.stringify({
          user: {
            id: authUserId,
            name: profile.name,
            email: normalizedEmail,
            phone: profile.phone,
            emailVerified,
            activeOrgId: null,
            createdAt: profile.created_at,
            updatedAt: profile.updated_at,
          },
          membership: null,
          organization: null,
          isPlatformAdmin: false,
          platformAdminRole: null,
          onboardingCompleted: false,
          needsOrganization: true,
        }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select('id, org_id, user_id, role, is_active, force_pin_change, last_login_at')
      .eq('user_id', authUserId)
      .eq('org_id', activeOrgId)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'Active membership not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select(
        'id, name, slug, currency, timezone, onboarding_completed, is_suspended, suspension_reason, has_cashier_enabled, has_storefront_enabled, has_api_enabled, storefront_location_id'
      )
      .eq('id', activeOrgId)
      .single()

    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (org.is_suspended) {
      return new Response(
        JSON.stringify({
          error: 'Organization suspended',
          message: org.suspension_reason ?? 'This organization has been suspended.',
        }),
        { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { data: platformAdminData } = await adminClient
      .from('platform_admins')
      .select('role')
      .eq('auth_user_id', authUserId)
      .eq('is_active', true)
      .maybeSingle()
    const isPlatformAdmin = !!platformAdminData
    const platformAdminRole =
      (platformAdminData?.role as 'super_admin' | 'moderator' | undefined) ?? null

    await adminClient
      .from('organization_memberships')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', membership.id)

    const onboardingCompleted = org.onboarding_completed === true

    return new Response(
      JSON.stringify({
        user: {
          id: authUserId,
          name: profile.name,
          email: normalizedEmail,
          phone: profile.phone,
          emailVerified,
          activeOrgId,
          createdAt: profile.created_at,
          updatedAt: profile.updated_at,
        },
        membership: {
          id: membership.id,
          orgId: membership.org_id,
          userId: membership.user_id,
          role: membership.role,
          hasPin: false,
          isActive: membership.is_active,
          forcePinChange: membership.force_pin_change,
          lastLoginAt: membership.last_login_at,
        },
        organization: {
          id: org.id,
          name: org.name,
          slug: org.slug,
          currency: org.currency,
          timezone: org.timezone,
          onboardingCompleted: org.onboarding_completed,
          isActive: !org.is_suspended,
          isSuspended: org.is_suspended,
          suspensionReason: org.suspension_reason,
          hasCashierEnabled: org.has_cashier_enabled,
          hasStorefrontEnabled: org.has_storefront_enabled,
          hasApiEnabled: org.has_api_enabled,
          storefrontLocationId: org.storefront_location_id,
        },
        isPlatformAdmin,
        platformAdminRole,
        onboardingCompleted,
        needsOrganization: false,
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
