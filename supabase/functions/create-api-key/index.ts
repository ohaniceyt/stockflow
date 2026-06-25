import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'

interface CreateApiKeyPayload {
  org_id: string
  name: string
  scopes: string[]
  allowed_location_ids?: string[] | null
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_SCOPES = ['read:products', 'read:stock', 'write:orders', 'read:orders']

function generateApiKey(): string {
  const prefix = 'sf'
  const random = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  return `${prefix}_${random}`
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
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

    const membership = await getCurrentMembership(adminClient, claims.sub)
    if (!membership || !['super_admin', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: CreateApiKeyPayload = await req.json()
    if (!payload.org_id || !payload.name?.trim() || !Array.isArray(payload.scopes)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (membership.org_id !== payload.org_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('has_api_enabled')
      .eq('id', payload.org_id)
      .single()

    if (orgError || !org?.has_api_enabled) {
      return new Response(JSON.stringify({ error: 'API not enabled for this organization' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const scopes = payload.scopes.filter((s) => VALID_SCOPES.includes(s))
    if (scopes.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid scopes provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const rawKey = generateApiKey()
    const keyHash = await hashKey(rawKey)

    const { data: inserted, error: insertError } = await adminClient
      .from('organization_api_keys')
      .insert({
        org_id: payload.org_id,
        name: payload.name.trim(),
        key_hash: keyHash,
        scopes,
        allowed_location_ids: payload.allowed_location_ids ?? null,
        created_by: claims.sub,
      })
      .select(
        'id, org_id, name, scopes, allowed_location_ids, last_used_at, created_at, revoked_at'
      )
      .single()

    if (insertError || !inserted) {
      return new Response(
        JSON.stringify({ error: insertError?.message ?? 'Failed to create API key' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    return new Response(
      JSON.stringify({
        key: rawKey,
        api_key: {
          id: inserted.id,
          orgId: inserted.org_id,
          name: inserted.name,
          scopes: inserted.scopes,
          allowedLocationIds: inserted.allowed_location_ids,
          lastUsedAt: inserted.last_used_at,
          createdAt: inserted.created_at,
          revokedAt: inserted.revoked_at,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
