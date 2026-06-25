import { edgeFetch } from '@/services/edgeFunctions'
import { supabase } from '@/services/supabase'
import type { Movement, MovementType } from '@/types'
import type { Database } from '@/types/database'

type MovementRow = Database['public']['Tables']['movements']['Row']

function mapRowToMovement(row: MovementRow, productOrgMap: Map<string, string>): Movement {
  return {
    id: row.id,
    orgId: productOrgMap.get(row.product_id) ?? '',
    productId: row.product_id,
    locationId: row.location_id,
    targetLocationId: row.target_location_id,
    type: row.type,
    quantity: row.quantity,
    stockBefore: row.stock_before,
    stockAfter: row.stock_after,
    reason: row.reason,
    contactId: row.contact_id,
    unitPrice: row.unit_price,
    isCancelled: row.is_cancelled,
    cancelledBy: row.cancelled_by,
    cancelledAt: row.cancelled_at,
    cashierSessionId: row.cashier_session_id,
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
  contactName?: string
}

async function fetchReferenceMaps(orgId: string, operatorIds: string[]) {
  const distinctOperatorIds = Array.from(new Set(operatorIds))

  const [
    { data: products, error: productsError },
    { data: locations, error: locationsError },
    { data: users, error: usersError },
    { data: contacts, error: contactsError },
  ] = await Promise.all([
    supabase.from('products').select('id, name, org_id').eq('org_id', orgId),
    supabase.from('locations').select('id, name').eq('org_id', orgId),
    distinctOperatorIds.length > 0
      ? supabase.from('users').select('id, name').in('id', distinctOperatorIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('contacts').select('id, name').eq('org_id', orgId),
  ])

  if (productsError) throw new Error(productsError.message)
  if (locationsError) throw new Error(locationsError.message)
  if (usersError) throw new Error(usersError.message)
  if (contactsError) throw new Error(contactsError.message)

  const productOrgMap = new Map(products.map((p) => [p.id, p.org_id]))
  const productMap = new Map(products.map((p) => [p.id, p.name]))
  const locationMap = new Map(locations.map((l) => [l.id, l.name]))
  const userMap = new Map(users.map((u) => [u.id, u.name]))
  const contactMap = new Map(contacts.map((c) => [c.id, c.name]))

  return { productOrgMap, productMap, locationMap, userMap, contactMap }
}

function attachDetails(
  rows: MovementRow[],
  productOrgMap: Map<string, string>,
  productMap: Map<string, string>,
  locationMap: Map<string, string>,
  userMap: Map<string, string>,
  contactMap: Map<string, string>
): MovementWithDetails[] {
  return rows.map((row) => ({
    ...mapRowToMovement(row, productOrgMap),
    productName: productMap.get(row.product_id),
    locationName: locationMap.get(row.location_id),
    targetLocationName: row.target_location_id
      ? locationMap.get(row.target_location_id)
      : undefined,
    operatorName: userMap.get(row.operator_id),
    contactName: row.contact_id ? contactMap.get(row.contact_id) : undefined,
  }))
}

export async function fetchMovements(orgId: string): Promise<MovementWithDetails[]> {
  if (!orgId) {
    throw new Error('Cannot fetch movements without an organization id')
  }

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id')
    .eq('org_id', orgId)

  if (productsError) throw new Error(productsError.message)

  const productIds = products.map((p) => p.id)
  if (productIds.length === 0) return []

  const { data: movements, error: movementsError } = await supabase
    .from('movements')
    .select('*')
    .in('product_id', productIds)
    .order('created_at', { ascending: false })
    .limit(200)

  if (movementsError) throw new Error(movementsError.message)

  const operatorIds = movements.map((row) => row.operator_id)
  const { productOrgMap, productMap, locationMap, userMap, contactMap } = await fetchReferenceMaps(
    orgId,
    operatorIds
  )

  return attachDetails(movements, productOrgMap, productMap, locationMap, userMap, contactMap)
}

export async function fetchMovementsByProduct(
  orgId: string,
  productId: string
): Promise<MovementWithDetails[]> {
  if (!orgId) {
    throw new Error('Cannot fetch movements without an organization id')
  }

  const { error: productError } = await supabase
    .from('products')
    .select('id')
    .eq('id', productId)
    .eq('org_id', orgId)
    .single()

  if (productError) {
    throw new Error(productError.message)
  }

  const { data: movements, error: movementsError } = await supabase
    .from('movements')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (movementsError) throw new Error(movementsError.message)

  const operatorIds = movements.map((row) => row.operator_id)
  const { productOrgMap, productMap, locationMap, userMap, contactMap } = await fetchReferenceMaps(
    orgId,
    operatorIds
  )

  return attachDetails(movements, productOrgMap, productMap, locationMap, userMap, contactMap)
}

export async function createMovement(input: {
  orgId: string
  productId: string
  locationId: string
  targetLocationId?: string | null
  type: MovementType
  quantity: number
  reason?: string | null
  contactId?: string | null
  unitPrice?: number | null
  cashierSessionId?: string | null
}): Promise<void> {
  await edgeFetch('record-movement', {
    method: 'POST',
    body: JSON.stringify({
      org_id: input.orgId,
      product_id: input.productId,
      location_id: input.locationId,
      target_location_id: input.targetLocationId ?? null,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason ?? null,
      contact_id: input.contactId ?? null,
      unit_price: input.unitPrice ?? null,
      cashier_session_id: input.cashierSessionId ?? null,
    }),
  })
}
