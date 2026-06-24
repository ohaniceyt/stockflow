import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

export interface OrgLimits {
  orgId: string
  planId: string
  isSuspended: boolean
  maxUsers: number | null
  maxProducts: number | null
  maxLocations: number | null
  maxMonthlyMovements: number | null
  usedUsers: number
  usedProducts: number
  usedLocations: number
  usedMovementsThisMonth: number
}

export async function getOrgLimits(
  adminClient: ReturnType<typeof createClient>,
  orgId: string
): Promise<OrgLimits | null> {
  const { data: org, error: orgError } = await adminClient
    .from('organizations')
    .select('id, is_suspended')
    .eq('id', orgId)
    .single()

  if (orgError || !org) {
    console.error('getOrgLimits org error:', orgError)
    return null
  }

  const { data: subscription, error: subError } = await adminClient
    .from('subscriptions')
    .select('plan_id')
    .eq('org_id', orgId)
    .single()

  if (subError || !subscription) {
    console.error('getOrgLimits subscription error:', subError)
    return null
  }

  const { data: plan, error: planError } = await adminClient
    .from('plans')
    .select('max_users, max_products, max_locations, max_monthly_movements')
    .eq('id', subscription.plan_id)
    .single()

  if (planError || !plan) {
    console.error('getOrgLimits plan error:', planError)
    return null
  }

  const [
    { count: usersCount, error: usersError },
    { count: productsCount, error: productsError },
    { count: locationsCount, error: locationsError },
    { data: movementsData, error: movementsError },
  ] = await Promise.all([
    adminClient
      .from('organization_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', orgId)
      .eq('is_active', true),
    adminClient.from('products').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_active', true),
    adminClient.from('locations').select('*', { count: 'exact', head: true }).eq('org_id', orgId),
    adminClient.rpc('movements_count_this_month', { p_org_id: orgId }),
  ])

  if (usersError) console.error('users count error:', usersError)
  if (productsError) console.error('products count error:', productsError)
  if (locationsError) console.error('locations count error:', locationsError)
  if (movementsError) console.error('movements count error:', movementsError)

  return {
    orgId,
    planId: subscription.plan_id,
    isSuspended: org.is_suspended,
    maxUsers: plan.max_users,
    maxProducts: plan.max_products,
    maxLocations: plan.max_locations,
    maxMonthlyMovements: plan.max_monthly_movements,
    usedUsers: usersCount ?? 0,
    usedProducts: productsCount ?? 0,
    usedLocations: locationsCount ?? 0,
    usedMovementsThisMonth: movementsData ?? 0,
  }
}

export function isAtLimit(used: number, max: number | null): boolean {
  return max !== null && used >= max
}
