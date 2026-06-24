import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

interface Payload {
  token: string
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { token }: Payload = await req.json()
    if (!token) {
      return new Response(JSON.stringify({ valid: false, error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: invitation, error } = await adminClient
      .from('invitations')
      .select('id, org_id, email, role, expires_at, status, organizations!inner(name)')
      .eq('token', token)
      .single()

    if (error || !invitation) {
      return new Response(JSON.stringify({ valid: false, error: 'Invitation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (invitation.status !== 'pending') {
      return new Response(
        JSON.stringify({ valid: false, error: `Invitation already ${invitation.status}` }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (invitation.expires_at && new Date(invitation.expires_at as string) < new Date()) {
      return new Response(JSON.stringify({ valid: false, error: 'Invitation expired' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const org = invitation.organizations as unknown as { name: string }

    return new Response(
      JSON.stringify({
        valid: true,
        invitationId: invitation.id,
        orgId: invitation.org_id,
        orgName: org.name,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ valid: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
