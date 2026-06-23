import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'

interface Payload {
  invitationId: string
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
    if (!claims?.sub || !claims?.email) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { invitationId }: Payload = await req.json()
    if (!invitationId) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Admins of the invitation's organization can cancel it; invitees can decline it.
    const { data: invitation, error: inviteError } = await adminClient
      .from('invitations')
      .select('id, email, org_id')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single()

    if (inviteError || !invitation) {
      return new Response(JSON.stringify({ error: 'Invitation not found or already processed' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const isInvitee = invitation.email.toLowerCase() === claims.email.toLowerCase()

    let isAdmin = false
    if (!isInvitee) {
      const { data: operator } = await adminClient
        .from('users')
        .select('role')
        .eq('id', claims.sub)
        .eq('org_id', invitation.org_id)
        .maybeSingle()
      isAdmin = operator?.role === 'super_admin' || operator?.role === 'admin'
    }

    if (!isInvitee && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error } = await adminClient
      .from('invitations')
      .update({ status: 'declined' })
      .eq('id', invitationId)
      .eq('status', 'pending')

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
