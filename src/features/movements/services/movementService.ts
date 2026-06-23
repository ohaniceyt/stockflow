import { edgeFetch } from '@/services/edgeFunctions'
import { supabase } from '@/services/supabase'
import type { Movement, MovementType } from '@/types'
import type { Database } from '@/types/database'

type MovementRow = Database['public']['Tables']['movements']['Row']

function mapRowToMovement(row: MovementRow): Movement {
  return {
    id: row.id,
    productId: row.product_id,
    locationId: row.location_id,
    targetLocationId: row.target_location_id,
    type: row.type,
    quantity: row.quantity,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    reason: row.reason,
    operatorId: row.operator_id,
    referenceId: row.reference_id,
    createdAt: row.created_at,
  }
}

export interface MovementWithDetails extends Movement {
  productName?: string
  locationName?: string
  targetLocationName?: string
  operatorName?: string
}

export async function fetchMovements(): Promise<MovementWithDetails[]> {
  const [
    { data: movements, error: movementsError },
    { data: products, error: productsError },
    { data: locations, error: locationsError },
    { data: users, error: usersError },
  ] = await Promise.all([
    supabase.from('movements').select('*').order('created_at', { ascending: false }).limit(200),
    supabase.from('products').select('id, name'),
    supabase.from('locations').select('id, name'),
    supabase.from('users').select('id, name'),
  ])

  if (movementsError) throw new Error(movementsError.message)
  if (productsError) throw new Error(productsError.message)
  if (locationsError) throw new Error(locationsError.message)
  if (usersError) throw new Error(usersError.message)

  const productMap = new Map(products.map((p) => [p.id, p.name]))
  const locationMap = new Map(locations.map((l) => [l.id, l.name]))
  const userMap = new Map(users.map((u) => [u.id, u.name]))

  return movements.map((row) => ({
    ...mapRowToMovement(row),
    productName: productMap.get(row.product_id),
    locationName: locationMap.get(row.location_id),
    targetLocationName: row.target_location_id
      ? locationMap.get(row.target_location_id)
      : undefined,
    operatorName: userMap.get(row.operator_id),
  }))
}

export async function createMovement(input: {
  productId: string
  locationId: string
  targetLocationId?: string | null
  type: MovementType
  quantity: number
  reason?: string | null
}): Promise<void> {
  await edgeFetch('record-movement', {
    method: 'POST',
    body: JSON.stringify({
      product_id: input.productId,
      location_id: input.locationId,
      target_location_id: input.targetLocationId ?? null,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
    }),
  })
}
