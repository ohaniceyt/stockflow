import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'

interface Payload {
  membershipId: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { membershipId }: Payload = await req.json()
    if (!membershipId) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: membership, error: membershipError } = await adminClient
      .from('organization_memberships')
      .select(
        'id, org_id, user_id, role, force_pin_change, users!inner(id, name, email, email_verified), organizations!inner(id, name, onboarding_completed, is_suspended)'
      )
      .eq('id', membershipId)
      .eq('user_id', claims.sub)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      return new Response(JSON.stringify({ error: 'Membership not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const org = membership.organizations as unknown as {
      id: string
      name: string
      onboarding_completed: boolean
      is_suspended: boolean
    }

    if (org.is_suspended) {
      return new Response(JSON.stringify({ error: 'Organization suspended' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await adminClient.from('users').update({ active_org_id: org.id }).eq('id', claims.sub)

    const profile = membership.users as unknown as {
      id: string
      name: string
      email: string
      email_verified: boolean
    }

    const onboardingCompleted =
      ['super_admin', 'admin'].includes(membership.role as string) &&
      org.onboarding_completed === true

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: profile.id,
          membershipId: membership.id,
          orgId: org.id,
          orgName: org.name,
          name: profile.name,
          email: profile.email,
          emailVerified: profile.email_verified,
          role: membership.role,
          forcePinChange: membership.force_pin_change,
          onboardingCompleted,
        },
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
