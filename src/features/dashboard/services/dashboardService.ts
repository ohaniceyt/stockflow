import { supabase } from '@/services/supabase'

export interface MovementStatsTotals {
  movements_count: number
  in_count: number
  out_count: number
  in_qty: number
  out_qty: number
  revenue: number
  real_revenue: number
  real_profit: number
  estimated_revenue: number
  estimated_margin: number
}

export interface DailyFluxPoint {
  /** 'YYYY-MM-DD' in the org's local timezone */
  day: string
  in_qty: number
  out_qty: number
  out_revenue: number
}

export interface TopProductRow {
  product_id: string
  name: string
  unit: string
  qty_sold: number
  revenue: number
}

export interface ProductBalanceRow {
  product_id: string
  name: string
  unit: string
  in_qty: number
  out_qty: number
}

export interface RotationRow {
  product_id: string
  name: string
  unit: string
  sold_qty: number
  current_qty: number
  ratio: number
}

export interface MovementStatsResult {
  totals: MovementStatsTotals
  daily_flux: DailyFluxPoint[]
  top_products: TopProductRow[]
  product_balances: ProductBalanceRow[]
  rotation: RotationRow[]
}

export interface MovementStatsRange {
  from: string | null
  to: string | null
}

export async function fetchMovementStats(
  orgId: string,
  range: MovementStatsRange
): Promise<MovementStatsResult> {
  const { data, error } = await supabase.rpc('get_movement_stats', {
    p_org_id: orgId,
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw new Error(error.message)
  return (data ?? {
    totals: {
      movements_count: 0,
      in_count: 0,
      out_count: 0,
      in_qty: 0,
      out_qty: 0,
      revenue: 0,
      real_revenue: 0,
      real_profit: 0,
      estimated_revenue: 0,
      estimated_margin: 0,
    },
    daily_flux: [],
    top_products: [],
    product_balances: [],
    rotation: [],
  }) as unknown as MovementStatsResult
}

export async function fetchHasCashierSale(orgId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_cashier_sale', { p_org_id: orgId })
  if (error) throw new Error(error.message)
  return data
}
