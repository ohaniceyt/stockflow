/* eslint-disable @typescript-eslint/await-thenable */
import type { Page, Route, Request } from '@playwright/test'
import { DEFAULT_MOCK_SESSION } from './auth'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-requested-with',
}

function jsonBody(data: unknown) {
  return JSON.stringify(data)
}

function now() {
  return new Date().toISOString()
}

function newId() {
  return crypto.randomUUID()
}

function getString(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  if (value === undefined || value === null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return ''
}

function getNullableString(body: Record<string, unknown>, key: string): string | null {
  const value = body[key]
  if (value === undefined || value === null) return null
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return null
}

function getNumber(body: Record<string, unknown>, key: string, fallback = 0): number {
  const value = body[key]
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

function getBoolean(body: Record<string, unknown>, key: string, fallback = true): boolean {
  const value = body[key]
  if (value === undefined || value === null) return fallback
  return Boolean(value)
}

interface ProductRow {
  id: string
  org_id: string
  name: string
  category: string | null
  unit: string
  threshold: number
  cost_price: number
  selling_price: number
  supplier: string | null
  description: string | null
  barcode: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface CategoryRow {
  id: string
  org_id: string
  name: string
  created_at: string
  updated_at: string
}

interface ContactRow {
  id: string
  org_id: string
  type: 'SUPPLIER' | 'CUSTOMER'
  name: string
  email: string | null
  phone: string | null
  address: string | null
  tax_id: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface LocationRow {
  id: string
  org_id: string
  name: string
  is_default: boolean
  created_at: string
  updated_at: string
}

interface MovementRow {
  id: string
  product_id: string
  location_id: string
  target_location_id: string | null
  type: 'IN' | 'OUT' | 'TRANSFER' | 'ADJUSTMENT'
  quantity: number
  stock_before: number
  stock_after: number
  reason: string | null
  contact_id: string | null
  operator_id: string
  reference_id: string | null
  created_at: string
}

interface StockLevelRow {
  id: string
  product_id: string
  location_id: string
  quantity: number
  updated_at: string
}

interface MockState {
  products: ProductRow[]
  categories: CategoryRow[]
  contacts: ContactRow[]
  locations: LocationRow[]
  movements: MovementRow[]
  stockLevels: StockLevelRow[]
}

let state: MockState = {
  products: [],
  categories: [],
  contacts: [],
  locations: [],
  movements: [],
  stockLevels: [],
}

function seedState() {
  const orgId = DEFAULT_MOCK_SESSION.organization.id
  const nowIso = now()

  const location: LocationRow = {
    id: newId(),
    org_id: orgId,
    name: 'Entrepôt principal',
    is_default: true,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const product: ProductRow = {
    id: newId(),
    org_id: orgId,
    name: 'Produit test',
    category: 'Test',
    unit: 'pièce',
    threshold: 5,
    cost_price: 100,
    selling_price: 150,
    supplier: null,
    description: null,
    barcode: null,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const category: CategoryRow = {
    id: newId(),
    org_id: orgId,
    name: 'Test',
    created_at: nowIso,
    updated_at: nowIso,
  }

  const supplier: ContactRow = {
    id: newId(),
    org_id: orgId,
    type: 'SUPPLIER',
    name: 'Fournisseur Seed',
    email: 'seed@supplier.test',
    phone: '+225 01 02 03 04 05',
    address: null,
    tax_id: null,
    notes: null,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const customer: ContactRow = {
    id: newId(),
    org_id: orgId,
    type: 'CUSTOMER',
    name: 'Client Seed',
    email: 'seed@customer.test',
    phone: '+225 05 04 03 02 01',
    address: null,
    tax_id: null,
    notes: null,
    is_active: true,
    created_at: nowIso,
    updated_at: nowIso,
  }

  const stockLevel: StockLevelRow = {
    id: newId(),
    product_id: product.id,
    location_id: location.id,
    quantity: 50,
    updated_at: nowIso,
  }

  state = {
    products: [product],
    categories: [category],
    contacts: [supplier, customer],
    locations: [location],
    movements: [],
    stockLevels: [stockLevel],
  }
}

export function resetMockState() {
  seedState()
}

function getOrgId(url: URL): string {
  const orgFilter = url.searchParams.get('org_id')
  if (orgFilter?.startsWith('eq.')) return orgFilter.slice(3)
  return DEFAULT_MOCK_SESSION.organization.id
}

function matchTable(url: URL, table: string) {
  return url.pathname === `/rest/v1/${table}` || url.pathname.endsWith(`/rest/v1/${table}`)
}

async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await req.postData()
    return JSON.parse(raw ?? '{}') as Record<string, unknown>
  } catch {
    return {}
  }
}

function fulfillCors(route: Route, status = 200, body?: string) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: corsHeaders,
    body,
  })
}

export async function setupMockBackend(page: Page) {
  resetMockState()

  await page.route('**/functions/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      return fulfillCors(route)
    }

    const url = new URL(req.url())
    const functionName = url.pathname.split('/').pop()
    const body = await readJson(req)

    if (functionName === 'initialize-session') {
      const { user, membership, organization } = DEFAULT_MOCK_SESSION
      return fulfillCors(
        route,
        200,
        jsonBody({
          user,
          membership,
          organization,
          isPlatformAdmin: false,
          platformAdminRole: null,
          onboardingCompleted: true,
        })
      )
    }

    if (functionName === 'create-product') {
      const orgId = getString(body, 'org_id') || getOrgId(url)
      const row: ProductRow = {
        id: newId(),
        org_id: orgId,
        name: getString(body, 'name'),
        category: getNullableString(body, 'category'),
        unit: getString(body, 'unit'),
        threshold: getNumber(body, 'threshold'),
        cost_price: getNumber(body, 'cost_price'),
        selling_price: getNumber(body, 'selling_price'),
        supplier: getNullableString(body, 'supplier'),
        description: getNullableString(body, 'description'),
        barcode: getNullableString(body, 'barcode'),
        is_active: getBoolean(body, 'is_active'),
        created_at: now(),
        updated_at: now(),
      }
      state.products.push(row)
      return fulfillCors(route, 200, jsonBody(row))
    }

    if (functionName === 'bulk-create-products') {
      const orgId = getString(body, 'org_id') || getOrgId(url)
      const products = body.products
      if (!Array.isArray(products)) {
        return fulfillCors(route, 400, jsonBody({ error: 'Invalid request' }))
      }

      const errors: string[] = []
      let created = 0

      for (const item of products as Record<string, unknown>[]) {
        const name = getString(item, 'name')
        if (!name) {
          errors.push('Nom manquant')
          continue
        }
        const categoryName = getNullableString(item, 'category')
        if (categoryName) {
          const exists = state.categories.some(
            (c) => c.org_id === orgId && c.name.toLowerCase() === categoryName.toLowerCase()
          )
          if (!exists) {
            state.categories.push({
              id: newId(),
              org_id: orgId,
              name: categoryName,
              created_at: now(),
              updated_at: now(),
            })
          }
        }
        state.products.push({
          id: newId(),
          org_id: orgId,
          name,
          category: categoryName,
          unit: getString(item, 'unit') || 'unité',
          threshold: getNumber(item, 'threshold'),
          cost_price: getNumber(item, 'cost_price'),
          selling_price: getNumber(item, 'selling_price'),
          supplier: getNullableString(item, 'supplier'),
          description: getNullableString(item, 'description'),
          barcode: getNullableString(item, 'barcode'),
          is_active: getBoolean(item, 'is_active'),
          created_at: now(),
          updated_at: now(),
        })
        created++
      }

      return fulfillCors(route, 200, jsonBody({ created, total: products.length, errors }))
    }

    if (functionName === 'create-contact') {
      const orgId = getString(body, 'org_id') || getOrgId(url)
      const row: ContactRow = {
        id: newId(),
        org_id: orgId,
        type: getString(body, 'type') as ContactRow['type'],
        name: getString(body, 'name'),
        email: getNullableString(body, 'email'),
        phone: getNullableString(body, 'phone'),
        address: getNullableString(body, 'address'),
        tax_id: getNullableString(body, 'tax_id'),
        notes: getNullableString(body, 'notes'),
        is_active: getBoolean(body, 'is_active'),
        created_at: now(),
        updated_at: now(),
      }
      state.contacts.push(row)
      return fulfillCors(route, 200, jsonBody(row))
    }

    if (functionName === 'record-movement') {
      const quantity = getNumber(body, 'quantity')
      const movement: MovementRow = {
        id: newId(),
        product_id: getString(body, 'product_id'),
        location_id: getString(body, 'location_id'),
        target_location_id: getNullableString(body, 'target_location_id'),
        type: getString(body, 'type') as MovementRow['type'],
        quantity,
        stock_before: 0,
        stock_after: quantity,
        reason: getNullableString(body, 'reason'),
        contact_id: getNullableString(body, 'contact_id'),
        operator_id: DEFAULT_MOCK_SESSION.user.id,
        reference_id: getNullableString(body, 'reference_id'),
        created_at: now(),
      }
      state.movements.unshift(movement)
      return fulfillCors(route, 200, jsonBody({ movement_id: movement.id }))
    }

    return fulfillCors(route, 404, jsonBody({ error: 'Function not mocked' }))
  })

  await page.route('**/rest/v1/**', async (route) => {
    const req = route.request()
    if (req.method() === 'OPTIONS') {
      return fulfillCors(route)
    }

    const url = new URL(req.url())
    const method = req.method()

    // organizations
    if (matchTable(url, 'organizations')) {
      if (method === 'GET') {
        const select = url.searchParams.get('select') ?? '*'
        const org = {
          ...DEFAULT_MOCK_SESSION.organization,
          slug: 'e2e-org',
          country: 'CI',
        }
        if (select !== '*') {
          const fields = select.split(',').map((f) => f.trim())
          const projected: Record<string, unknown> = {}
          for (const field of fields) {
            if (field in org) projected[field] = org[field as keyof typeof org]
          }
          return fulfillCors(route, 200, jsonBody([projected]))
        }
        return fulfillCors(route, 200, jsonBody([org]))
      }
    }

    // products
    if (matchTable(url, 'products')) {
      const select = url.searchParams.get('select') ?? '*'
      if (method === 'GET') {
        if (select.includes('id') && select.includes('name') && !select.includes('*')) {
          return fulfillCors(
            route,
            200,
            jsonBody(state.products.map((p) => ({ id: p.id, name: p.name })))
          )
        }
        return fulfillCors(
          route,
          200,
          jsonBody(
            state.products.map((p) => ({
              id: p.id,
              name: p.name,
              unit: p.unit,
              category: p.category,
              barcode: p.barcode,
              threshold: p.threshold,
              cost_price: p.cost_price,
              selling_price: p.selling_price,
              org_id: p.org_id,
              is_active: p.is_active,
              created_at: p.created_at,
              updated_at: p.updated_at,
            }))
          )
        )
      }

      if (method === 'PATCH') {
        const idFilter = url.searchParams.get('id')
        if (!idFilter?.startsWith('eq.')) {
          return fulfillCors(route, 400, jsonBody({ error: 'Missing id filter' }))
        }
        const id = idFilter.slice(3)
        const body = await readJson(req)
        const idx = state.products.findIndex((p) => p.id === id)
        if (idx === -1) {
          return fulfillCors(route, 404, jsonBody({ error: 'Product not found' }))
        }
        const update = body as Partial<ProductRow>
        state.products[idx] = { ...state.products[idx], ...update, updated_at: now() }
        return fulfillCors(route, 200, jsonBody([state.products[idx]]))
      }
    }

    // categories
    if (matchTable(url, 'categories')) {
      if (method === 'GET') {
        return fulfillCors(route, 200, jsonBody(state.categories))
      }

      if (method === 'POST') {
        const body = await readJson(req)
        const row: CategoryRow = {
          id: newId(),
          org_id: getOrgId(url),
          name: getString(body, 'name'),
          created_at: now(),
          updated_at: now(),
        }
        state.categories.push(row)
        return fulfillCors(route, 200, jsonBody(row))
      }

      if (method === 'PATCH') {
        const idFilter = url.searchParams.get('id')
        if (!idFilter?.startsWith('eq.')) {
          return fulfillCors(route, 400, jsonBody({ error: 'Missing id filter' }))
        }
        const id = idFilter.slice(3)
        const body = await readJson(req)
        const idx = state.categories.findIndex((c) => c.id === id)
        if (idx === -1) {
          return fulfillCors(route, 404, jsonBody({ error: 'Category not found' }))
        }
        const update = body as Partial<CategoryRow>
        state.categories[idx] = { ...state.categories[idx], ...update, updated_at: now() }
        return fulfillCors(route, 200, jsonBody([state.categories[idx]]))
      }

      if (method === 'DELETE') {
        const idFilter = url.searchParams.get('id')
        if (idFilter?.startsWith('eq.')) {
          state.categories = state.categories.filter((c) => c.id !== idFilter.slice(3))
        }
        return fulfillCors(route, 200, jsonBody([]))
      }
    }

    // contacts
    if (matchTable(url, 'contacts')) {
      const select = url.searchParams.get('select') ?? '*'
      if (method === 'GET') {
        if (select.includes('id') && select.includes('name') && !select.includes('*')) {
          return fulfillCors(
            route,
            200,
            jsonBody(state.contacts.map((c) => ({ id: c.id, name: c.name })))
          )
        }
        return fulfillCors(route, 200, jsonBody(state.contacts))
      }

      if (method === 'PATCH') {
        const idFilter = url.searchParams.get('id')
        if (!idFilter?.startsWith('eq.')) {
          return fulfillCors(route, 400, jsonBody({ error: 'Missing id filter' }))
        }
        const id = idFilter.slice(3)
        const body = await readJson(req)
        const idx = state.contacts.findIndex((c) => c.id === id)
        if (idx === -1) {
          return fulfillCors(route, 404, jsonBody({ error: 'Contact not found' }))
        }
        const update = body as Partial<ContactRow>
        state.contacts[idx] = { ...state.contacts[idx], ...update, updated_at: now() }
        return fulfillCors(route, 200, jsonBody([state.contacts[idx]]))
      }

      if (method === 'DELETE') {
        const idFilter = url.searchParams.get('id')
        if (idFilter?.startsWith('eq.')) {
          state.contacts = state.contacts.filter((c) => c.id !== idFilter.slice(3))
        }
        return fulfillCors(route, 200, jsonBody([]))
      }
    }

    // locations
    if (matchTable(url, 'locations')) {
      const select = url.searchParams.get('select') ?? '*'
      if (method === 'GET') {
        if (select.includes('id') && select.includes('name') && !select.includes('*')) {
          return fulfillCors(
            route,
            200,
            jsonBody(state.locations.map((l) => ({ id: l.id, name: l.name })))
          )
        }
        return fulfillCors(route, 200, jsonBody(state.locations))
      }
    }

    // movements
    if (matchTable(url, 'movements')) {
      if (method === 'GET') {
        return fulfillCors(route, 200, jsonBody(state.movements))
      }
    }

    // stock_levels
    if (matchTable(url, 'stock_levels')) {
      if (method === 'GET') {
        return fulfillCors(route, 200, jsonBody(state.stockLevels))
      }
    }

    // users
    if (matchTable(url, 'users')) {
      if (method === 'GET') {
        return fulfillCors(
          route,
          200,
          jsonBody([{ id: DEFAULT_MOCK_SESSION.user.id, name: DEFAULT_MOCK_SESSION.user.name }])
        )
      }
    }

    return fulfillCors(route, 404, jsonBody({ error: 'Endpoint not mocked' }))
  })
}
