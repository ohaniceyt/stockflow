import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import { getBearerToken, parseJwt } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getOrgLimits, isAtLimit } from '../_shared/quotas.ts'

interface BulkProductInput {
  name: string
  category?: string | null
  unit?: string
  threshold?: number
  cost_price?: number
  selling_price?: number
  supplier?: string | null
  description?: string | null
  barcode?: string | null
  is_active?: boolean
}

interface BulkCreateProductsPayload {
  org_id: string
  products: BulkProductInput[]
}

const MAX_BATCH_SIZE = 500

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeName(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
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
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const claims = parseJwt(token)
    if (!claims?.sub) {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const operator = await getCurrentMembership(adminClient, claims.sub)

    if (!operator || !['super_admin', 'admin'].includes(operator.role)) {
      return jsonResponse(
        {
          error: 'Forbidden',
          debug: 'Operator not found or insufficient role',
        },
        403
      )
    }

    const payload: BulkCreateProductsPayload = await req.json()
    const { org_id, products } = payload

    if (!org_id || !Array.isArray(products)) {
      return jsonResponse({ error: 'Invalid request' }, 400)
    }

    if (operator.org_id !== org_id) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    if (products.length === 0) {
      return jsonResponse({ created: 0, total: 0, errors: [] })
    }

    if (products.length > MAX_BATCH_SIZE) {
      return jsonResponse(
        { error: `Batch too large. Maximum ${MAX_BATCH_SIZE} products allowed.` },
        400
      )
    }

    const limits = await getOrgLimits(adminClient, org_id)
    if (!limits) {
      return jsonResponse({ error: 'Could not load organization limits' }, 500)
    }
    if (limits.isSuspended) {
      return jsonResponse({ error: 'Organization suspended' }, 403)
    }
    if (isAtLimit(limits.usedProducts + products.length - 1, limits.maxProducts)) {
      return jsonResponse({ error: 'Product limit reached for this plan' }, 403)
    }

    // 1. Collect unique category names.
    const categoryNames = new Set<string>()
    const validProducts: BulkProductInput[] = []
    const errors: string[] = []

    products.forEach((item, index) => {
      const name = normalizeName(item.name)
      if (!name) {
        errors.push(`Ligne ${index + 1}: le nom est requis`)
        return
      }
      const category = normalizeName(item.category)
      if (category) categoryNames.add(category)

      validProducts.push({
        name,
        category,
        unit: normalizeName(item.unit) ?? 'unité',
        threshold: Math.max(0, Math.round(normalizeNumber(item.threshold, 0))),
        cost_price: Math.max(0, normalizeNumber(item.cost_price, 0)),
        selling_price: Math.max(0, normalizeNumber(item.selling_price, 0)),
        supplier: normalizeName(item.supplier),
        description: normalizeName(item.description),
        barcode: normalizeName(item.barcode),
        is_active: item.is_active !== false,
      })
    })

    if (validProducts.length === 0) {
      return jsonResponse({ created: 0, total: products.length, errors }, 400)
    }

    // 2. Build category id map by upserting categories.
    const categoryIdMap = new Map<string, string>()
    if (categoryNames.size > 0) {
      const namesArray = Array.from(categoryNames)
      const { data: existingCategories } = await adminClient
        .from('categories')
        .select('id, name')
        .eq('org_id', org_id)
        .in('name', namesArray)

      if (existingCategories) {
        for (const cat of existingCategories) {
          categoryIdMap.set(cat.name, cat.id)
        }
      }

      for (const name of namesArray) {
        if (categoryIdMap.has(name)) continue
        const { data: inserted, error: insertError } = await adminClient
          .from('categories')
          .insert({ org_id, name })
          .select('id')
          .single()

        if (insertError || !inserted) {
          // Name may have been created concurrently; fetch it.
          const { data: conflict } = await adminClient
            .from('categories')
            .select('id')
            .eq('org_id', org_id)
            .eq('name', name)
            .single()
          if (conflict?.id) {
            categoryIdMap.set(name, conflict.id)
          }
        } else {
          categoryIdMap.set(name, inserted.id)
        }
      }
    }

    // 3. Build product rows.
    const productRows = validProducts.map((p) => ({
      org_id,
      name: p.name,
      category: p.category,
      unit: p.unit,
      threshold: p.threshold,
      cost_price: p.cost_price,
      selling_price: p.selling_price,
      supplier: p.supplier,
      description: p.description,
      barcode: p.barcode,
      is_active: p.is_active,
    }))

    // 4. Bulk insert products.
    const { data: insertedProducts, error: insertError } = await adminClient
      .from('products')
      .insert(productRows)
      .select('id')

    if (insertError) {
      return jsonResponse(
        {
          error: insertError.message,
          created: 0,
          total: products.length,
          errors,
        },
        500
      )
    }

    const created = insertedProducts?.length ?? 0

    return jsonResponse({
      created,
      total: products.length,
      errors,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return jsonResponse({ error: message }, 500)
  }
})
