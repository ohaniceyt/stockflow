import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

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

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateOrderNumber(): string {
  const now = new Date()
  const prefix = 'CMD'
  const timestamp = now.getTime().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

async function getApiKey(
  adminClient: ReturnType<typeof createClient>,
  keyHeader: string
): Promise<ApiKeyRecord | null> {
  const { data, error } = await adminClient
    .from('organization_api_keys')
    .select('id, org_id, key_hash, scopes, allowed_location_ids, revoked_at')
    .eq('key_hash', keyHeader)
    .is('revoked_at', null)
    .single()

  if (error || !data) return null
  return data as unknown as ApiKeyRecord
}

async function getOrgFeatures(
  adminClient: ReturnType<typeof createClient>,
  orgId: string
): Promise<{ has_api_enabled: boolean; storefront_location_id: string | null } | null> {
  const { data, error } = await adminClient
    .from('organizations')
    .select('has_api_enabled, storefront_location_id')
    .eq('id', orgId)
    .single()
  if (error || !data) return null
  return data as unknown as { has_api_enabled: boolean; storefront_location_id: string | null }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function errorResponse(message: string, status: number): Response {
  return jsonResponse({ error: message }, status)
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

    const apiKey = req.headers.get('x-stockflow-api-key')
    if (!apiKey) {
      return errorResponse('Missing X-StockFlow-API-Key header', 401)
    }

    const keyRecord = await getApiKey(adminClient, apiKey)
    if (!keyRecord) {
      return errorResponse('Invalid or revoked API key', 401)
    }

    const features = await getOrgFeatures(adminClient, keyRecord.org_id)
    if (!features?.has_api_enabled) {
      return errorResponse('API not enabled for this organization', 403)
    }

    const url = new URL(req.url)
    const path = url.pathname.replace(/^\/api\/v1\/?/, '')
    const segments = path.split('/').filter(Boolean)

    // Update last_used_at asynchronously, do not block request
    void adminClient
      .from('organization_api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', keyRecord.id)

    // GET /products or /products/:id
    if (segments[0] === 'products' && req.method === 'GET') {
      const { data: products, error } = await adminClient
        .from('products')
        .select('id, name, category, unit, threshold, selling_price, supplier, description, barcode, is_active, created_at, updated_at')
        .eq('org_id', keyRecord.org_id)
        .eq('is_active', true)

      if (error) return errorResponse(error.message, 500)

      if (segments[1]) {
        const product = products?.find((p) => p.id === segments[1])
        if (!product) return errorResponse('Product not found', 404)
        return jsonResponse(product)
      }

      return jsonResponse(products ?? [])
    }

    // GET /stock?location_id=...
    if (segments[0] === 'stock' && req.method === 'GET') {
      const requestedLocationId = url.searchParams.get('location_id')
      if (
        requestedLocationId &&
        keyRecord.allowed_location_ids &&
        !keyRecord.allowed_location_ids.includes(requestedLocationId)
      ) {
        return errorResponse('Location not allowed for this API key', 403)
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
      if (error) return errorResponse(error.message, 500)
      return jsonResponse(data ?? [])
    }

    // POST /orders
    if (segments[0] === 'orders' && req.method === 'POST') {
      if (!keyRecord.scopes.includes('write:orders')) {
        return errorResponse('Insufficient scope', 403)
      }

      const payload: CreateOrderPayload = await req.json()
      if (
        !payload.customer_name?.trim() ||
        !payload.customer_email?.trim() ||
        !Array.isArray(payload.items) ||
        payload.items.length === 0
      ) {
        return errorResponse('Invalid request', 400)
      }

      let locationId = payload.location_id ?? features.storefront_location_id
      if (!locationId) {
        return errorResponse('No location_id provided and no storefront location configured', 400)
      }

      if (
        keyRecord.allowed_location_ids &&
        !keyRecord.allowed_location_ids.includes(locationId)
      ) {
        return errorResponse('Location not allowed for this API key', 403)
      }

      const productIds = payload.items.map((i) => i.product_id)
      const { data: products, error: productsError } = await adminClient
        .from('products')
        .select('id, name, selling_price, is_active')
        .in('id', productIds)
        .eq('org_id', keyRecord.org_id)
        .eq('is_active', true)

      if (productsError) return errorResponse(productsError.message, 500)

      const productMap = new Map(products?.map((p) => [p.id, p]))
      const missing = payload.items.find((i) => !productMap.has(i.product_id))
      if (missing) return errorResponse('Product not found or inactive', 400)

      const { data: stock, error: stockError } = await adminClient
        .from('stock_levels')
        .select('product_id, quantity')
        .eq('location_id', locationId)
        .in('product_id', productIds)

      if (stockError) return errorResponse(stockError.message, 500)

      const stockMap = new Map(stock?.map((s) => [s.product_id, s.quantity]))
      const insufficient = payload.items.find((i) => (stockMap.get(i.product_id) ?? 0) < i.quantity)
      if (insufficient) return errorResponse('Insufficient stock', 400)

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
          return errorResponse(contactError?.message ?? 'Contact creation failed', 500)
        }
        contactId = newContact.id
      }

      const orderNumber = generateOrderNumber()
      const movementIds: string[] = []

      for (const item of payload.items) {
        const product = productMap.get(item.product_id)!
        const unitPrice = item.unit_price ?? product.selling_price ?? 0

        const { data: movement, error: movementError } = await adminClient.rpc('record_movement', {
          p_org_id: keyRecord.org_id,
          p_product_id: item.product_id,
          p_location_id: locationId,
          p_target_location_id: null,
          p_type: 'OUT',
          p_quantity: item.quantity,
          p_reason: `Commande API ${orderNumber}`,
          p_contact_id: contactId,
          p_unit_price: unitPrice,
          p_cashier_session_id: null,
        })

        if (movementError) return errorResponse(movementError.message, 500)
        movementIds.push(movement as string)
      }

      return jsonResponse({
        order_id: movementIds[0],
        order_number: orderNumber,
        movement_count: movementIds.length,
      })
    }

    return errorResponse('Not found', 404)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return errorResponse(message, 500)
  }
})
