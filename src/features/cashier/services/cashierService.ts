import { supabase } from '@/services/supabase'
import { edgeFetch } from '@/services/edgeFunctions'
import type { CashierSession, Movement } from '@/types'

type CashierSessionStatus = CashierSession['status']
import type { Database } from '@/types/database'

type CashierSessionRow = Database['public']['Tables']['cashier_sessions']['Row']

function mapRowToCashierSession(row: CashierSessionRow): CashierSession {
  return {
    id: row.id,
    orgId: row.org_id,
    locationId: row.location_id,
    operatorId: row.operator_id,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    openingBalance: row.opening_balance,
    closingBalance: row.closing_balance,
    dailyRevenue: row.daily_revenue ?? 0,
    status: row.status as CashierSessionStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function fetchOpenSession(
  orgId: string,
  locationId: string
): Promise<CashierSession | null> {
  const { data, error } = await supabase
    .from('cashier_sessions')
    .select('*')
    .eq('org_id', orgId)
    .eq('location_id', locationId)
    .eq('status', 'open')
    .order('opened_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(error.message)
  }

  return data ? mapRowToCashierSession(data) : null
}

export async function openSession(input: {
  orgId: string
  locationId: string
  operatorId: string
  openingBalance: number
}): Promise<CashierSession> {
  const { data, error } = await supabase
    .from('cashier_sessions')
    .insert({
      org_id: input.orgId,
      location_id: input.locationId,
      operator_id: input.operatorId,
      opening_balance: input.openingBalance,
      status: 'open',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRowToCashierSession(data)
}

export async function closeSession(input: {
  sessionId: string
  closingBalance: number
  dailyRevenue: number
}): Promise<CashierSession> {
  const { data, error } = await supabase
    .from('cashier_sessions')
    .update({
      closing_balance: input.closingBalance,
      daily_revenue: input.dailyRevenue,
      status: 'closed',
      closed_at: new Date().toISOString(),
    })
    .eq('id', input.sessionId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRowToCashierSession(data)
}

export async function cancelSale(movementId: string): Promise<void> {
  await edgeFetch('cancel-sale', {
    method: 'POST',
    body: JSON.stringify({ movement_id: movementId }),
  })
}

export function filterSalesBySession(movements: Movement[], sessionId: string | null): Movement[] {
  if (!sessionId) return []
  return movements.filter(
    (m) => m.cashierSessionId === sessionId && m.type === 'OUT' && !m.isCancelled
  )
}

export function computeSessionRevenue(movements: Movement[]): number {
  return movements.reduce((sum, m) => sum + (m.unitPrice ?? 0) * m.quantity, 0)
}
