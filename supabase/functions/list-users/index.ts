import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

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
    const authHeader = req.headers.get('authorization')
    const apiKey = req.headers.get('apikey') ?? serviceRoleKey

    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        global: {
          headers: {
            ...(authHeader ? { Authorization: authHeader } : {}),
            apikey: apiKey,
          },
        },
      },
    })

    let orgId: string | null = null
    let isSuperAdmin = false

    if (authHeader) {
      const {
        data: { user: authUser },
        error: userError,
      } = await client.auth.getUser()
      if (!userError && authUser?.id) {
        const { data: operator } = await client
          .from('users')
          .select('role, org_id')
          .eq('id', authUser.id)
          .single()
        if (operator) {
          orgId = operator.org_id
          isSuperAdmin = operator.role === 'super_admin'
        }
      }
    }

    let query = client
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
