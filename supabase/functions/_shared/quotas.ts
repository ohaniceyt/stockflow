import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getLogger } from './logger.ts'

const logger = getLogger('quotas')

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
    logger.error('get_org_limits_org_failed', { org_id: orgId }, orgError ?? undefined)
    return null
  }

  const { data: subscription, error: subError } = await adminClient
    .from('subscriptions')
    .select('plan_id')
    .eq('org_id', orgId)
    .single()

  if (subError || !subscription) {
    logger.error('get_org_limits_subscription_failed', { org_id: orgId }, subError ?? undefined)
    return null
  }

  const { data: plan, error: planError } = await adminClient
    .from('plans')
    .select('max_users, max_products, max_locations, max_monthly_movements')
    .eq('id', subscription.plan_id)
    .single()

  if (planError || !plan) {
    logger.error('get_org_limits_plan_failed', { org_id: orgId, plan_id: subscription.plan_id }, planError ?? undefined)
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

  if (usersError) logger.error('users_count_failed', { org_id: orgId }, usersError)
  if (productsError) logger.error('products_count_failed', { org_id: orgId }, productsError)
  if (locationsError) logger.error('locations_count_failed', { org_id: orgId }, locationsError)
  if (movementsError) logger.error('movements_count_failed', { org_id: orgId }, movementsError)

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
