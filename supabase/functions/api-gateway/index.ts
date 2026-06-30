import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { getClientIp, isRateLimited, recordRateLimitRequest } from '../_shared/rateLimit.ts'

interface ApiKeyRecord {
  id: string
  org_id: string
  key_hash: string
  scopes: string[]
  allowed_location_ids: string[] | null
  revoked_at: string | null
}

interface OrderItem {
  product_id: string
  quantity: number
  unit_price?: number | null
}

interface CreateOrderPayload {
  customer_name: string
  customer_email: string
  customer_phone?: string | null
  address?: string | null
  location_id?: string | null
  items: OrderItem[]
}

interface OrgFeatures {
  has_api_enabled: boolean
  storefront_location_id: string | null
}

function generateOrderNumber(): string {
  const now = new Date()
  const prefix = 'CMD'
  const timestamp = now.getTime().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getApiKey(
  adminClient: ReturnType<typeof createClient>,
  keyHeader: string
): Promise<ApiKeyRecord | null> {
  const keyHash = await hashKey(keyHeader)
  const { data, error } = await adminClient
    .from('organization_api_keys')
    .select('id, org_id, key_hash, scopes, allowed_location_ids, revoked_at')
    .eq('key_hash', keyHash)
    .is('revoked_at', null)
    .single()

  if (error || !data) return null
  return data as unknown as ApiKeyRecord
}

async function getOrgFeatures(
  adminClient: ReturnType<typeof createClient>,
  orgId: string
): Promise<OrgFeatures | null> {
  const { data, error } = await adminClient
    .from('organizations')
    .select('has_api_enabled, storefront_location_id')
    .eq('id', orgId)
    .single()
  if (error || !data) return null
  return data as unknown as OrgFeatures
}

function logApiRequest(
  adminClient: ReturnType<typeof createClient>,
  apiKeyId: string,
  orgId: string,
  method: string,
  path: string,
  ip: string | null,
  statusCode: number
): void {
  void adminClient.from('api_request_logs').insert({
    api_key_id: apiKeyId,
    org_id: orgId,
    method,
    path,
    ip_address: ip,
    status_code: statusCode,
  })
}

function jsonResponse(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

function errorResponse(req: Request, message: string, status: number): Response {
  return jsonResponse(req, { error: message }, status)
}

async function handleRequest(
  adminClient: ReturnType<typeof createClient>,
  keyRecord: ApiKeyRecord,
  features: OrgFeatures,
  req: Request,
  url: URL,
  path: string
): Promise<Response> {
  const segments = path.split('/').filter(Boolean)

  // Update last_used_at asynchronously, do not block request
  void adminClient
    .from('organization_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)

  // GET /products or /products/:id
  if (segments[0] === 'products' && req.method === 'GET') {
    if (!keyRecord.scopes.includes('read:products')) {
      return errorResponse(req, 'Insufficient scope', 403)
    }

    const { data: products, error } = await adminClient
      .from('products')
      .select(
        'id, name, category, unit, threshold, selling_price, supplier, description, barcode, is_active, created_at, updated_at'
      )
      .eq('org_id', keyRecord.org_id)
      .eq('is_active', true)

    if (error) return errorResponse(req, error.message, 500)

    if (segments[1]) {
      const product = products?.find((p) => p.id === segments[1])
      if (!product) return errorResponse(req, 'Product not found', 404)
      return jsonResponse(req, product)
    }

    return jsonResponse(req, products ?? [])
  }

  // GET /stock?location_id=...
  if (segments[0] === 'stock' && req.method === 'GET') {
    if (!keyRecord.scopes.includes('read:stock')) {
      return errorResponse(req, 'Insufficient scope', 403)
    }

    const requestedLocationId = url.searchParams.get('location_id')
    if (
      requestedLocationId &&
      keyRecord.allowed_location_ids &&
      !keyRecord.allowed_location_ids.includes(requestedLocationId)
    ) {
      return errorResponse(req, 'Location not allowed for this API key', 403)
    }

    let query = adminClient
      .from('stock_levels')
      .select('id, product_id, location_id, quantity, updated_at')
      .eq('org_id', keyRecord.org_id)

    if (requestedLocationId) {
      query = query.eq('location_id', requestedLocationId)
    } else if (keyRecord.allowed_location_ids && keyRecord.allowed_location_ids.length > 0) {
      query = query.in('location_id', keyRecord.allowed_location_ids)
    }

    const { data, error } = await query
    if (error) return errorResponse(req, error.message, 500)
    return jsonResponse(req, data ?? [])
  }

  // POST /orders
  if (segments[0] === 'orders' && req.method === 'POST') {
    if (!keyRecord.scopes.includes('write:orders')) {
      return errorResponse(req, 'Insufficient scope', 403)
    }

    const payload: CreateOrderPayload = await req.json()
    if (
      !payload.customer_name?.trim() ||
      !payload.customer_email?.trim() ||
      !Array.isArray(payload.items) ||
      payload.items.length === 0
    ) {
      return errorResponse(req, 'Invalid request', 400)
    }

    const locationId = payload.location_id ?? features.storefront_location_id
    if (!locationId) {
      return errorResponse(
        req,
        'No location_id provided and no storefront location configured',
        400
      )
    }

    if (keyRecord.allowed_location_ids && !keyRecord.allowed_location_ids.includes(locationId)) {
      return errorResponse(req, 'Location not allowed for this API key', 403)
    }

    const productIds = payload.items.map((i) => i.product_id)
    const { data: products, error: productsError } = await adminClient
      .from('products')
      .select('id, name, selling_price, is_active')
      .in('id', productIds)
      .eq('org_id', keyRecord.org_id)
      .eq('is_active', true)

    if (productsError) return errorResponse(req, productsError.message, 500)

    const productMap = new Map(products?.map((p) => [p.id, p]))
    const missing = payload.items.find((i) => !productMap.has(i.product_id))
    if (missing) return errorResponse(req, 'Product not found or inactive', 400)

    const { data: stock, error: stockError } = await adminClient
      .from('stock_levels')
      .select('product_id, quantity')
      .eq('location_id', locationId)
      .in('product_id', productIds)

    if (stockError) return errorResponse(req, stockError.message, 500)

    const stockMap = new Map(stock?.map((s) => [s.product_id, s.quantity]))
    const insufficient = payload.items.find((i) => (stockMap.get(i.product_id) ?? 0) < i.quantity)
    if (insufficient) return errorResponse(req, 'Insufficient stock', 400)

    // Upsert customer contact
    const { data: existingContact } = await adminClient
      .from('contacts')
      .select('id')
      .eq('org_id', keyRecord.org_id)
      .eq('email', payload.customer_email.trim().toLowerCase())
      .eq('type', 'CUSTOMER')
      .maybeSingle()

    let contactId = existingContact?.id ?? null
    if (!contactId) {
      const { data: newContact, error: contactError } = await adminClient
        .from('contacts')
        .insert({
          org_id: keyRecord.org_id,
          type: 'CUSTOMER',
          name: payload.customer_name.trim(),
          email: payload.customer_email.trim().toLowerCase(),
          phone: payload.customer_phone?.trim() || null,
          address: payload.address?.trim() || null,
          is_active: true,
        })
        .select('id')
        .single()

      if (contactError || !newContact) {
        return errorResponse(req, contactError?.message ?? 'Contact creation failed', 500)
      }
      contactId = newContact.id
    }

    const orderNumber = generateOrderNumber()

    const { data: orderResult, error: orderError } = await adminClient.rpc(
      'record_storefront_order',
      {
        p_org_id: keyRecord.org_id,
        p_location_id: locationId,
        p_contact_id: contactId,
        p_items: payload.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.unit_price ?? productMap.get(i.product_id)?.selling_price,
        })),
        p_reason: `Commande API ${orderNumber}`,
      }
    )

    if (orderError || !orderResult) {
      return errorResponse(req, orderError?.message ?? 'Order failed', 500)
    }

    const movementIds = (orderResult as { movement_ids: string[] }).movement_ids

    return jsonResponse(req, {
      order_id: movementIds[0] ?? null,
      order_number: orderNumber,
      movement_count: movementIds.length,
    })
  }

  return errorResponse(req, 'Not found', 404)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  let adminClient: ReturnType<typeof createClient> | null = null
  let keyRecord: ApiKeyRecord | null = null
  let requestPath = ''
  let clientIp: string | null = null

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    clientIp = getClientIp(req)
    const ipKey = clientIp ? { key: clientIp, type: 'ip' as const } : null
    if (
      ipKey &&
      (await isRateLimited(adminClient, ipKey, { maxRequests: 100, windowMinutes: 15 }))
    ) {
      return errorResponse(req, 'Too many requests from this network. Try again later.', 429)
    }

    const apiKey = req.headers.get('x-stockflow-api-key')
    if (!apiKey) {
      return errorResponse(req, 'Missing X-StockFlow-API-Key header', 401)
    }

    keyRecord = await getApiKey(adminClient, apiKey)
    if (!keyRecord) {
      return errorResponse(req, 'Invalid or revoked API key', 401)
    }

    const features = await getOrgFeatures(adminClient, keyRecord.org_id)
    if (!features?.has_api_enabled) {
      return errorResponse(req, 'API not enabled for this organization', 403)
    }

    const url = new URL(req.url)
    requestPath = url.pathname
      .replace(/^\/functions\/v1\/api-gateway\//, '')
      .replace(/^\/api-gateway\//, '')
      .replace(/^api\/v1\//, '')
      .replace(/^\/api\/v1\//, '')
      .replace(/^\//, '')
    clientIp = getClientIp(req)

    const response = await handleRequest(adminClient, keyRecord, features, req, url, requestPath)

    if (ipKey) {
      await recordRateLimitRequest(adminClient, ipKey)
    }

    logApiRequest(
      adminClient,
      keyRecord.id,
      keyRecord.org_id,
      req.method,
      requestPath,
      clientIp,
      response.status
    )

    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (adminClient && keyRecord) {
      logApiRequest(
        adminClient,
        keyRecord.id,
        keyRecord.org_id,
        req.method,
        requestPath,
        clientIp,
        500
      )
    }
    return errorResponse(req, message, 500)
  }
})
