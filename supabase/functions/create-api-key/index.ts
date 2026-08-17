import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import {
  parseJsonBody,
  isUuid,
  isNonEmptyString,
  isStringArray,
  isUuidArray,
} from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  org_id: unknown
  name: unknown
  scopes: unknown
  allowed_location_ids?: unknown
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

    const membership = await getCurrentMembership(adminClient, claims.sub)
    if (!membership || !['super_admin', 'admin'].includes(membership.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const body = parsed.body
    if (!isUuid(body.org_id) || !isNonEmptyString(body.name, 100) || !isStringArray(body.scopes)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (membership.org_id !== body.org_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('has_api_enabled')
      .eq('id', body.org_id as string)
      .single()

    if (orgError || !org?.has_api_enabled) {
      return new Response(JSON.stringify({ error: 'API not enabled for this organization' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const scopes = (body.scopes as string[]).filter((s) => VALID_SCOPES.includes(s))
    if (scopes.length === 0) {
      return new Response(JSON.stringify({ error: 'No valid scopes provided' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      body.allowed_location_ids !== undefined &&
      body.allowed_location_ids !== null &&
      !isUuidArray(body.allowed_location_ids, 50)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid allowed_location_ids' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const rawKey = generateApiKey()
    const keyHash = await hashKey(rawKey)

    const { data: inserted, error: insertError } = await adminClient
      .from('organization_api_keys')
      .insert({
        org_id: body.org_id as string,
        name: (body.name as string).trim(),
        key_hash: keyHash,
        scopes,
        allowed_location_ids:
          body.allowed_location_ids === undefined || body.allowed_location_ids === null
            ? null
            : (body.allowed_location_ids as string[]),
        created_by: claims.sub,
      })
      .select(
        'id, org_id, name, scopes, allowed_location_ids, last_used_at, created_at, revoked_at'
      )
      .single()

    if (insertError || !inserted) {
      console.error('create-api-key insert failed:', insertError)
      return genericInternalErrorResponse(req)
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
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
