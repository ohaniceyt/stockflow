import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'

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

    // Public login directory: the login page must show available profiles before any user
    // is authenticated. We therefore accept requests that carry only the public anon key.
    // TODO: redesign login flow so profiles are not exposed publicly (e.g. enter email first).
    const token = getBearerToken(req)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let orgId: string | null = null
    let isSuperAdmin = false

    if (token) {
      const claims = parseJwt(token)
      if (claims?.sub) {
        const { data: operator } = await adminClient
          .from('users')
          .select('role, org_id')
          .eq('id', claims.sub)
          .single()
        if (operator) {
          orgId = operator.org_id
          isSuperAdmin = operator.role === 'super_admin'
        }
      }
    }

    let query = adminClient
      .from('users')
      .select('id, name, email, email_verified, role, org_id, is_active')
      .eq('is_active', true)
      .order('name')

    if (!isSuperAdmin && orgId) {
      query = query.eq('org_id', orgId)
    }

    const { data: users, error } = await query

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ users: users ?? [] }), {
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
