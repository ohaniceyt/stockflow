import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import {
  isEnum,
  isNonNegativeInteger,
  isNumber,
  isPositiveInteger,
  isString,
  isUuid,
  parseJsonBody,
} from '../_shared/validate.ts'
import { genericInternalErrorResponse, internalErrorResponse } from '../_shared/errors.ts'

interface OrgFeatures {
  has_cashier_enabled: boolean
  has_storefront_enabled: boolean
  has_api_enabled: boolean
  storefront_location_id: string | null
}

async function getOrgFeatures(
  adminClient: ReturnType<typeof createClient>,
  orgId: string
): Promise<OrgFeatures | null> {
  const { data, error } = await adminClient
    .from('organizations')
    .select('has_cashier_enabled, has_storefront_enabled, has_api_enabled, storefront_location_id')
    .eq('id', orgId)
    .single()
  if (error || !data) return null
  return data as unknown as OrgFeatures
}

interface RecordMovementPayload {
  org_id: string
  product_id: string
  location_id: string
  target_location_id?: string | null
  type: 'IN' | 'OUT' | 'INVENTORY' | 'ADJUSTMENT' | 'TRANSFER'
  quantity: number
  reason?: string | null
  contact_id?: string | null
  unit_price?: number | null
  cashier_session_id?: string | null
  client_operation_id?: string | null
}

const ALLOWED_TYPES: RecordMovementPayload['type'][] = [
  'IN',
  'OUT',
  'INVENTORY',
  'ADJUSTMENT',
  'TRANSFER',
]

function validatePayload(
  payload: RecordMovementPayload
): { ok: false; error: string } | { ok: true } {
  if (!isUuid(payload.org_id)) {
    return { ok: false, error: 'Entreprise invalide' }
  }
  if (!isEnum(payload.type, ALLOWED_TYPES)) {
    return { ok: false, error: 'Type de mouvement invalide' }
  }
  const quantityValid =
    payload.type === 'ADJUSTMENT' || payload.type === 'INVENTORY'
      ? isNonNegativeInteger(payload.quantity)
      : isPositiveInteger(payload.quantity)
  if (!quantityValid) {
    return { ok: false, error: 'La quantité doit être un entier positif' }
  }
  if (!isUuid(payload.product_id) || !isUuid(payload.location_id)) {
    return { ok: false, error: 'Produit et emplacement requis' }
  }
  if (payload.type === 'TRANSFER') {
    if (!isUuid(payload.target_location_id)) {
      return { ok: false, error: 'Un transfert nécessite un emplacement cible' }
    }
    if (payload.target_location_id === payload.location_id) {
      return { ok: false, error: "L'emplacement cible doit être différent de l'origine" }
    }
  } else if (
    payload.target_location_id !== null &&
    payload.target_location_id !== undefined &&
    !isUuid(payload.target_location_id)
  ) {
    return { ok: false, error: "L'emplacement cible doit être un UUID valide" }
  }
  if (payload.reason !== null && payload.reason !== undefined && !isString(payload.reason, 500)) {
    return { ok: false, error: 'La raison est invalide' }
  }
  if (
    payload.contact_id !== null &&
    payload.contact_id !== undefined &&
    !isUuid(payload.contact_id)
  ) {
    return { ok: false, error: 'Contact invalide' }
  }
  if (
    payload.cashier_session_id !== null &&
    payload.cashier_session_id !== undefined &&
    !isUuid(payload.cashier_session_id)
  ) {
    return { ok: false, error: 'Session de caisse invalide' }
  }
  if (
    payload.client_operation_id !== null &&
    payload.client_operation_id !== undefined &&
    !isUuid(payload.client_operation_id)
  ) {
    return { ok: false, error: 'Opération client invalide' }
  }
  if (
    payload.unit_price !== null &&
    payload.unit_price !== undefined &&
    !isNumber(payload.unit_price)
  ) {
    return { ok: false, error: 'Prix unitaire invalide' }
  }
  return { ok: true }
}

async function validateOwnership(
  adminClient: ReturnType<typeof createClient>,
  orgId: string,
  payload: RecordMovementPayload
): Promise<boolean> {
  const [product, location, target] = await Promise.all([
    adminClient
      .from('products')
      .select('id')
      .eq('id', payload.product_id)
      .eq('org_id', orgId)
      .maybeSingle(),
    adminClient
      .from('locations')
      .select('id')
      .eq('id', payload.location_id)
      .eq('org_id', orgId)
      .maybeSingle(),
    payload.target_location_id
      ? adminClient
          .from('locations')
          .select('id')
          .eq('id', payload.target_location_id)
          .eq('org_id', orgId)
          .maybeSingle()
      : Promise.resolve({ data: { id: 'ignored' }, error: null } as const),
  ])

  if (product.error || location.error || (payload.target_location_id && target.error)) {
    return false
  }
  return Boolean(product.data && location.data && (!payload.target_location_id || target.data))
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
      console.error('[record-movement] missing env vars')
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
      console.warn('[record-movement] jwt verification failed')
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    console.info('[record-movement] request received', claims.sub)

    const parseResult = await parseJsonBody<RecordMovementPayload>(req)
    if (!parseResult.ok) {
      console.warn('[record-movement] json parse failed', claims.sub)
      return parseResult.response
    }

    const payload = parseResult.body
    const payloadValidation = validatePayload(payload)
    if (!payloadValidation.ok) {
      return new Response(JSON.stringify({ error: payloadValidation.error }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    console.info('[record-movement] membership lookup', claims.sub, payload.org_id)

    const operator = await getCurrentMembership(adminClient, claims.sub, payload.org_id)

    if (!operator || !['super_admin', 'admin', 'operator', 'cashier'].includes(operator.role)) {
      console.warn(
        '[record-movement] membership not found or insufficient role',
        claims.sub,
        payload.org_id
      )
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
        }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    const owned = await validateOwnership(adminClient, operator.org_id, payload)
    if (!owned) {
      return new Response(JSON.stringify({ error: 'Produit ou emplacement non autorisé' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const features = await getOrgFeatures(adminClient, operator.org_id)
    if (payload.cashier_session_id && !features?.has_cashier_enabled) {
      return new Response(JSON.stringify({ error: 'Caisse non activée pour cette entreprise' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const limits = await getOrgLimits(adminClient, operator.org_id)
    if (!limits) {
      console.error('[record-movement] org limits unavailable', operator.org_id)
      return internalErrorResponse(
        req,
        503,
        'Service temporairement indisponible, veuillez réessayer'
      )
    }
    if (limits.isSuspended) {
      return new Response(JSON.stringify({ error: 'Organization suspended' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (isAtLimit(limits.usedMovementsThisMonth, limits.maxMonthlyMovements)) {
      return new Response(
        JSON.stringify({ error: 'Monthly movement limit reached for this plan' }),
        {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    // record_movement uses auth.uid() to resolve the operator and their org.
    // Calling it through the service-role adminClient would make auth.uid() null,
    // so we call it through a user client that carries the operator's JWT.
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data, error } = await userClient.rpc('record_movement', {
      p_org_id: operator.org_id,
      p_product_id: payload.product_id,
      p_location_id: payload.location_id,
      p_target_location_id: payload.target_location_id ?? null,
      p_type: payload.type,
      p_quantity: payload.quantity,
      p_reason: payload.reason ?? null,
      p_contact_id: payload.contact_id ?? null,
      p_unit_price: payload.unit_price ?? null,
      p_cashier_session_id: payload.cashier_session_id ?? null,
      p_client_operation_id: payload.client_operation_id ?? null,
    })

    if (error) {
      // The RPC raised a business-rule or data error (e.g. stock insuffisant,
      // rôle insuffisant, produit non autorisé). Surface a client-safe French
      // message so the user can act on it instead of a generic 500.
      const message = error.message?.toLowerCase() ?? ''
      if (message.includes('rôle insuffisant')) {
        return new Response(JSON.stringify({ error: 'Rôle insuffisant pour ce mouvement' }), {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('produit ou emplacement non autorisé')) {
        return new Response(JSON.stringify({ error: 'Produit ou emplacement non autorisé' }), {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('emplacement cible non autorisé')) {
        return new Response(JSON.stringify({ error: 'Emplacement cible non autorisé' }), {
          status: 403,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('stock insuffisant')) {
        return new Response(JSON.stringify({ error: 'Stock insuffisant' }), {
          status: 409,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('type de mouvement invalide')) {
        return new Response(JSON.stringify({ error: 'Type de mouvement invalide' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('la quantité doit être positive')) {
        return new Response(JSON.stringify({ error: 'La quantité doit être positive' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('un transfert nécessite un emplacement cible')) {
        return new Response(
          JSON.stringify({ error: 'Un transfert nécessite un emplacement cible' }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        )
      }
      if (message.includes('session de caisse invalide ou fermée')) {
        return new Response(JSON.stringify({ error: 'Session de caisse invalide ou fermée' }), {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (message.includes('contact invalide')) {
        return new Response(
          JSON.stringify({ error: 'Contact invalide pour ce type de mouvement' }),
          {
            status: 400,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        )
      }
      if (message.includes('duplicate key value') && message.includes('client_operation_id')) {
        return new Response(JSON.stringify({ error: 'Ce mouvement a déjà été enregistré' }), {
          status: 409,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        })
      }
      if (
        message.includes('utilisateur non authentifié') ||
        message.includes('opérateur non trouvé') ||
        message.includes('opérateur inactif')
      ) {
        return new Response(
          JSON.stringify({ error: 'Session invalide, veuillez vous reconnecter' }),
          {
            status: 401,
            headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
          }
        )
      }
      // Unexpected database/internal error: keep details server-side.
      console.error('[record-movement] rpc error', message, error)
      return genericInternalErrorResponse(req)
    }

    const movementId =
      data && typeof data === 'object' && 'id' in data && typeof data.id === 'string'
        ? data.id
        : data

    return new Response(JSON.stringify({ movement_id: movementId }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error('[record-movement] uncaught error', message, stack, err)
    return genericInternalErrorResponse(req)
  }
})
