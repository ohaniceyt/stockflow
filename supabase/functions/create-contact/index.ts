import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import {
  parseJsonBody,
  isUuid,
  isNonEmptyString,
  isEmail,
  isPhone,
  isEnum,
  isBoolean,
} from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface Payload {
  org_id: unknown
  type: unknown
  name: unknown
  email?: unknown
  phone?: unknown
  address?: unknown
  tax_id?: unknown
  notes?: unknown
  is_active?: unknown
}

const ALLOWED_TYPES = ['SUPPLIER', 'CUSTOMER'] as const

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

    const operator = await getCurrentMembership(adminClient, claims.sub)

    if (!operator || !['super_admin', 'admin', 'operator'].includes(operator.role)) {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
        }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const body = parsed.body
    if (
      !isUuid(body.org_id) ||
      !isEnum(body.type, ALLOWED_TYPES) ||
      !isNonEmptyString(body.name, 100)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (operator.org_id !== body.org_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (body.email !== undefined && body.email !== null && !isEmail(body.email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (body.phone !== undefined && body.phone !== null && !isPhone(body.phone)) {
      return new Response(JSON.stringify({ error: 'Invalid phone' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      body.address !== undefined &&
      body.address !== null &&
      !isNonEmptyString(body.address, 255)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid address' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (body.tax_id !== undefined && body.tax_id !== null && !isNonEmptyString(body.tax_id, 50)) {
      return new Response(JSON.stringify({ error: 'Invalid tax_id' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (body.notes !== undefined && body.notes !== null && !isNonEmptyString(body.notes, 1000)) {
      return new Response(JSON.stringify({ error: 'Invalid notes' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await adminClient
      .from('contacts')
      .insert({
        org_id: body.org_id as string,
        type: body.type as 'SUPPLIER' | 'CUSTOMER',
        name: (body.name as string).trim(),
        email:
          body.email === undefined || body.email === null
            ? null
            : (body.email as string).trim().toLowerCase(),
        phone:
          body.phone === undefined || body.phone === null ? null : (body.phone as string).trim(),
        address:
          body.address === undefined || body.address === null
            ? null
            : (body.address as string).trim(),
        tax_id:
          body.tax_id === undefined || body.tax_id === null ? null : (body.tax_id as string).trim(),
        notes:
          body.notes === undefined || body.notes === null ? null : (body.notes as string).trim(),
        is_active: isBoolean(body.is_active) ? body.is_active : true,
      })
      .select()
      .single()

    if (error || !data) {
      const isUniqueViolation = error?.code === '23505'
      const status = isUniqueViolation ? 409 : 500
      const message = isUniqueViolation
        ? 'A contact with this email already exists in your organization.'
        : 'Could not create contact'
      if (status === 500) {
        console.error('create-contact insert failed:', error)
        return genericInternalErrorResponse(req)
      }
      return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
