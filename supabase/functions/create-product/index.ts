import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import {
  parseJsonBody,
  isUuid,
  isNonEmptyString,
  isString,
  isNumber,
  isNonNegativeInteger,
  isBoolean,
} from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'

interface CreateProductPayload {
  org_id: string
  name: string
  category?: string | null
  unit: string
  threshold?: number
  cost_price?: number
  selling_price?: number
  supplier?: string | null
  description?: string | null
  barcode?: string | null
  is_active?: boolean
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
      return genericInternalErrorResponse(req)
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

    const parsed = await parseJsonBody<CreateProductPayload>(req)
    if (!parsed.ok) {
      return parsed.response
    }
    const payload = parsed.body

    if (
      !isUuid(payload.org_id) ||
      !isNonEmptyString(payload.name, 100) ||
      !isNonEmptyString(payload.unit, 20)
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      (payload.category !== undefined &&
        payload.category !== null &&
        !isString(payload.category, 50)) ||
      (payload.supplier !== undefined &&
        payload.supplier !== null &&
        !isString(payload.supplier, 100)) ||
      (payload.description !== undefined &&
        payload.description !== null &&
        !isString(payload.description, 1000)) ||
      (payload.barcode !== undefined && payload.barcode !== null && !isString(payload.barcode, 50))
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (payload.threshold !== undefined && !isNonNegativeInteger(payload.threshold)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (
      (payload.cost_price !== undefined && !isNumber(payload.cost_price)) ||
      (payload.selling_price !== undefined && !isNumber(payload.selling_price))
    ) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (payload.is_active !== undefined && !isBoolean(payload.is_active)) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (operator.org_id !== payload.org_id) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const limits = await getOrgLimits(adminClient, payload.org_id)
    if (!limits) {
      return genericInternalErrorResponse(req)
    }
    if (limits.isSuspended) {
      return new Response(JSON.stringify({ error: 'Organization suspended' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (isAtLimit(limits.usedProducts, limits.maxProducts)) {
      return new Response(JSON.stringify({ error: 'Product limit reached for this plan' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { data, error } = await adminClient
      .from('products')
      .insert({
        org_id: payload.org_id,
        name: payload.name,
        category: payload.category ?? null,
        unit: payload.unit,
        threshold: payload.threshold ?? 0,
        cost_price: payload.cost_price ?? 0,
        selling_price: payload.selling_price ?? 0,
        supplier: payload.supplier ?? null,
        description: payload.description ?? null,
        barcode: payload.barcode ?? null,
        is_active: payload.is_active ?? true,
      })
      .select()
      .single()

    if (error || !data) {
      // 23505 = unique_violation. Soit (org_id, barcode) via
      // products_org_barcode_uniq, soit (org_id, name) via
      // products_org_id_name_key. On renvoie un 409 lisible plutôt qu'un
      // 500 générique, et on distingue via le nom de la contrainte présent
      // dans error.message.
      if (error?.code === '23505') {
        const isBarcode = /barcode/i.test(error.message)
        const message = isBarcode
          ? 'Un produit avec ce code-barres existe déjà dans cette entreprise.'
          : 'Un produit avec ce nom existe déjà dans cette entreprise.'
        return new Response(JSON.stringify({ error: message }), {
          status: 409,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      return genericInternalErrorResponse(req)
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
