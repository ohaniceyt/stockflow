import { supabase } from '@/services/supabase'
import type { InventoryCount, InventorySession, Product, StockLevel } from '@/types'
import type { Database } from '@/types/database'

type SessionRow = Database['public']['Tables']['inventory_sessions']['Row']
type CountRow = Database['public']['Tables']['inventory_counts']['Row']
type SessionInsert = Database['public']['Tables']['inventory_sessions']['Insert']
type CountInsert = Database['public']['Tables']['inventory_counts']['Insert']

function mapSessionRow(row: SessionRow): InventorySession {
  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    name: row.name,
    status: row.status,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    operatorId: row.operator_id,
  }
}

function mapCountRow(row: CountRow): InventoryCount {
  return {
    id: row.id,
    sessionId: row.session_id,
    productId: row.product_id,
    locationId: row.location_id,
    theoreticalQuantity: row.theoretical_quantity,
    countedQuantity: row.counted_quantity,
    difference: row.difference,
    isValidated: row.is_validated,
    createdAt: row.created_at,
  }
}

export interface SessionWithDetails extends InventorySession {
  locationName?: string
  operatorName?: string
  counts?: InventoryCountWithDetails[]
}

export interface InventoryCountWithDetails extends InventoryCount {
  productName?: string
  productUnit?: string
}

export async function fetchInventorySessions(orgId: string): Promise<SessionWithDetails[]> {
  const [
    { data: sessions, error: sessionsError },
    { data: locations, error: locationsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabase
      .from('inventory_sessions')
      .select('*')
      .eq('org_id', orgId)
      .order('started_at', { ascending: false }),
    supabase.from('locations').select('id, name'),
    supabase.from('users').select('id, name'),
  ])

  if (sessionsError) throw new Error(sessionsError.message)
  if (locationsError) throw new Error(locationsError.message)
  if (usersError) throw new Error(usersError.message)

  const locationMap = new Map(locations.map((l) => [l.id, l.name]))
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  return sessions.map((row) => ({
    ...mapSessionRow(row),
    locationName: locationMap.get(row.location_id),
    operatorName: userMap.get(row.operator_id),
  }))
}

export async function fetchSessionCounts(sessionId: string): Promise<InventoryCountWithDetails[]> {
  const [{ data: counts, error: countsError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase.from('inventory_counts').select('*').eq('session_id', sessionId).order('created_at'),
      supabase.from('products').select('id, name, unit'),
    ])

  if (countsError) throw new Error(countsError.message)
  if (productsError) throw new Error(productsError.message)

  const productMap = new Map(
    products.map((p) => [p.id, p as Pick<Product, 'id' | 'name' | 'unit'>])
  )

  return counts.map((row) => ({
    ...mapCountRow(row),
    productName: productMap.get(row.product_id)?.name,
    productUnit: productMap.get(row.product_id)?.unit,
  }))
}

export async function createInventorySession(
  orgId: string,
  locationId: string,
  name: string,
  operatorId: string,
  products: Product[],
  stockLevels: StockLevel[]
): Promise<InventorySession> {
  const sessionInsert: SessionInsert = {
    org_id: orgId,
    location_id: locationId,
    name,
    status: 'pending',
    operator_id: operatorId,
  }

  const { data: session, error: sessionError } = await supabase
    .from('inventory_sessions')
    .insert([sessionInsert])
    .select()
    .single()

  if (sessionError) {
    throw new Error(sessionError.message)
  }

  const countsByProduct = new Map(stockLevels.map((sl) => [sl.productId, sl.quantity]))

  const countInserts: CountInsert[] = products
    .filter((p) => p.isActive)
    .map((p) => ({
      session_id: session.id,
      product_id: p.id,
      location_id: locationId,
      theoretical_quantity: countsByProduct.get(p.id) ?? 0,
      counted_quantity: countsByProduct.get(p.id) ?? 0,
      difference: 0,
      is_validated: false,
    }))

  if (countInserts.length > 0) {
    const { error: countsError } = await supabase.from('inventory_counts').insert(countInserts)
    if (countsError) {
      throw new Error(countsError.message)
    }
  }

  return mapSessionRow(session)
}

export async function updateCount(
  countId: string,
  countedQuantity: number
): Promise<InventoryCount> {
  const { data: existing, error: fetchError } = await supabase
    .from('inventory_counts')
    .select('*')
    .eq('id', countId)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  const { data: count, error } = await supabase
    .from('inventory_counts')
    .update({
      counted_quantity: countedQuantity,
      difference: countedQuantity - existing.theoretical_quantity,
      is_validated: true,
    })
    .eq('id', countId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return mapCountRow(count)
}

export async function applyInventorySession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('apply_inventory_session', { p_session_id: sessionId })

  if (error) {
    throw new Error(error.message)
  }
}
