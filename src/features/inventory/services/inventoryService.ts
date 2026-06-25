import { supabase } from '@/services/supabase'
import type { InventoryCount, InventorySession } from '@/types'
import type { Database } from '@/types/database'

type SessionRow = Database['public']['Tables']['inventory_sessions']['Row']
type CountRow = Database['public']['Tables']['inventory_counts']['Row']

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

function mapCountRow(row: CountRow, orgId?: string): InventoryCount {
  return {
    id: row.id,
    orgId: orgId ?? '',
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
}

export interface InventoryCountWithDetails extends InventoryCount {
  productName?: string
  productUnit?: string
}

export async function fetchInventorySessions(orgId: string): Promise<SessionWithDetails[]> {
  const [{ data: sessions, error: sessionsError }, { data: locations, error: locationsError }] =
    await Promise.all([
      supabase
        .from('inventory_sessions')
        .select('*')
        .eq('org_id', orgId)
        .order('started_at', { ascending: false }),
      supabase.from('locations').select('id, name').eq('org_id', orgId),
    ])

  if (sessionsError) throw new Error(sessionsError.message)
  if (locationsError) throw new Error(locationsError.message)

  const operatorIds = Array.from(new Set(sessions.map((s) => s.operator_id)))

  const { data: users, error: usersError } =
    operatorIds.length > 0
      ? await supabase.from('users').select('id, name').in('id', operatorIds)
      : { data: [], error: null }

  if (usersError) throw new Error(usersError.message)

  const locationMap = new Map(locations.map((l) => [l.id, l.name]))
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  return sessions.map((row) => ({
    ...mapSessionRow(row),
    locationName: locationMap.get(row.location_id),
    operatorName: userMap.get(row.operator_id),
  }))
}

export async function fetchSessionCounts(
  sessionId: string,
  orgId: string
): Promise<InventoryCountWithDetails[]> {
  const [{ data: counts, error: countsError }, { data: products, error: productsError }] =
    await Promise.all([
      supabase.from('inventory_counts').select('*').eq('session_id', sessionId).order('created_at'),
      supabase.from('products').select('id, name, unit').eq('org_id', orgId),
    ])

  if (countsError) throw new Error(countsError.message)
  if (productsError) throw new Error(productsError.message)

  const productMap = new Map(products.map((p) => [p.id, { id: p.id, name: p.name, unit: p.unit }]))

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
  operatorId: string
): Promise<InventorySession> {
  const { data, error } = await supabase.rpc('create_inventory_session', {
    p_org_id: orgId,
    p_location_id: locationId,
    p_name: name,
    p_operator_id: operatorId,
  })

  if (error) {
    throw new Error(error.message)
  }

  const { data: session, error: fetchError } = await supabase
    .from('inventory_sessions')
    .select('*')
    .eq('id', data)
    .single()

  if (fetchError) {
    throw new Error(fetchError.message)
  }

  return mapSessionRow(session)
}

export async function updateCount(countId: string, countedQuantity: number): Promise<void> {
  const { error } = await supabase.rpc('update_inventory_count', {
    p_count_id: countId,
    p_counted_quantity: countedQuantity,
  })

  if (error) {
    throw new Error(error.message)
  }
}

export async function applyInventorySession(sessionId: string): Promise<void> {
  const { error } = await supabase.rpc('apply_inventory_session', { p_session_id: sessionId })

  if (error) {
    throw new Error(error.message)
  }
}
