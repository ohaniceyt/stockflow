import { supabaseKey } from '@/services/supabase'
import type { SudoTarget } from '@/types'
import type {
  ActivityLogRow,
  BackOfficeOrganization,
  BackOfficeUser,
  LoginAttemptRow,
  Paginated,
  PlatformAuditLogRow,
  PlatformOverview,
} from '../types'

const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL)

function getAccessToken(): string | null {
  try {
    const raw = localStorage.getItem('stockflow-session')
    if (!raw) return null
    const parsed = JSON.parse(raw) as { accessToken?: string }
    return parsed.accessToken ?? null
  } catch {
    return null
  }
}

async function platformFetch(
  path: string,
  options?: RequestInit
): Promise<Record<string, unknown>> {
  const token = getAccessToken()
  if (!token) {
    throw new Error('Not authenticated')
  }

  const headers: Record<string, string> = {
    apikey: supabaseKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (options?.headers) {
    Object.assign(headers, options.headers as Record<string, string>)
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
    ...options,
    headers,
  })

  const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string }
  if (!res.ok) {
    throw new Error(data.error ?? data.message ?? `Request failed: ${String(res.status)}`)
  }
  return data
}

export async function getOverview(): Promise<PlatformOverview> {
  const data = await platformFetch('/platform-get-overview')
  return {
    organizationsTotal: Number(data.organizationsTotal ?? 0),
    organizationsActive: Number(data.organizationsActive ?? 0),
    usersTotal: Number(data.usersTotal ?? 0),
    usersOnline: Number(data.usersOnline ?? 0),
    movementsToday: Number(data.movementsToday ?? 0),
    subscriptionsByPlan: (data.subscriptionsByPlan as Record<string, number> | undefined) ?? {},
    recentActivity: (data.recentActivity as PlatformAuditLogRow[] | undefined) ?? [],
  }
}

export interface ListOrganizationsFilters {
  search?: string
  planId?: string
  status?: 'active' | 'suspended' | 'all'
  limit?: number
  offset?: number
}

export async function listOrganizations(
  filters: ListOrganizationsFilters = {}
): Promise<Paginated<BackOfficeOrganization>> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.planId) params.set('planId', filters.planId)
  if (filters.status) params.set('status', filters.status)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))

  const data = await platformFetch(`/platform-list-organizations?${params.toString()}`)
  const organizations = data.organizations as BackOfficeOrganization[] | undefined
  return {
    data: organizations ?? [],
    total: Number(data.total ?? 0),
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  }
}

export async function getOrganization(orgId: string): Promise<{
  organization: BackOfficeOrganization
  recentActivity: ActivityLogRow[]
}> {
  const data = await platformFetch(`/platform-get-organization?orgId=${encodeURIComponent(orgId)}`)
  return {
    organization: data.organization as BackOfficeOrganization,
    recentActivity: (data.recentActivity as ActivityLogRow[] | undefined) ?? [],
  }
}

export interface ListUsersFilters {
  search?: string
  orgId?: string
  role?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export async function listUsers(
  filters: ListUsersFilters = {}
): Promise<Paginated<BackOfficeUser>> {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.orgId) params.set('orgId', filters.orgId)
  if (filters.role) params.set('role', filters.role)
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))

  const data = await platformFetch(`/platform-list-users?${params.toString()}`)
  const users = data.users as BackOfficeUser[] | undefined
  return {
    data: users ?? [],
    total: Number(data.total ?? 0),
    limit: Number(data.limit ?? 20),
    offset: Number(data.offset ?? 0),
  }
}

export async function getUser(userId: string): Promise<{
  user: BackOfficeUser
  recentActivity: ActivityLogRow[]
  loginAttempts: LoginAttemptRow[]
}> {
  const data = await platformFetch(`/platform-get-user?userId=${encodeURIComponent(userId)}`)
  return {
    user: data.user as BackOfficeUser,
    recentActivity: (data.recentActivity as ActivityLogRow[] | undefined) ?? [],
    loginAttempts: (data.loginAttempts as LoginAttemptRow[] | undefined) ?? [],
  }
}

export interface ListAuditLogsFilters {
  action?: string
  targetType?: string
  targetId?: string
  limit?: number
  offset?: number
}

export async function listAuditLogs(
  filters: ListAuditLogsFilters = {}
): Promise<Paginated<PlatformAuditLogRow>> {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.targetType) params.set('targetType', filters.targetType)
  if (filters.targetId) params.set('targetId', filters.targetId)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))

  const data = await platformFetch(`/platform-list-audit-logs?${params.toString()}`)
  const logs = data.logs as PlatformAuditLogRow[] | undefined
  return {
    data: logs ?? [],
    total: Number(data.total ?? 0),
    limit: Number(data.limit ?? 50),
    offset: Number(data.offset ?? 0),
  }
}

export async function suspendOrganization(
  orgId: string,
  isSuspended: boolean,
  reason?: string
): Promise<void> {
  await platformFetch('/platform-suspend-organization', {
    method: 'POST',
    body: JSON.stringify({ orgId, isSuspended, reason }),
  })
}

export async function setOrganizationPlan(orgId: string, planId: string): Promise<void> {
  await platformFetch('/platform-set-organization-plan', {
    method: 'POST',
    body: JSON.stringify({ orgId, planId }),
  })
}

export async function updateOrganizationSlug(orgId: string, newSlug: string): Promise<void> {
  await platformFetch('/platform-update-organization-slug', {
    method: 'POST',
    body: JSON.stringify({ orgId, newSlug }),
  })
}

export async function getOrganizationSlugHistory(orgId: string): Promise<
  {
    id: string
    old_slug: string
    new_slug: string
    changed_at: string
    changed_by: string | null
  }[]
> {
  const data = await platformFetch(
    `/platform-get-organization-slug-history?orgId=${encodeURIComponent(orgId)}`
  )
  return (
    (data.history as
      | {
          id: string
          old_slug: string
          new_slug: string
          changed_at: string
          changed_by: string | null
        }[]
      | undefined) ?? []
  )
}

export async function resetUserPin(membershipId: string): Promise<void> {
  await platformFetch('/platform-reset-user-pin', {
    method: 'POST',
    body: JSON.stringify({ membershipId }),
  })
}

export async function toggleUserActive(membershipId: string, isActive: boolean): Promise<void> {
  await platformFetch('/platform-toggle-user-active', {
    method: 'POST',
    body: JSON.stringify({ membershipId, isActive }),
  })
}

export async function sendPasswordReset(email: string): Promise<void> {
  await platformFetch('/platform-send-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function impersonate(target: SudoTarget): Promise<SudoTarget> {
  const data = await platformFetch('/platform-impersonate', {
    method: 'POST',
    body: JSON.stringify({
      orgId: target.id,
      userId: target.targetUserId,
    }),
  })
  const sudoTarget = data.sudoTarget as SudoTarget | undefined
  return sudoTarget ?? target
}

export async function exitImpersonation(targetId?: string): Promise<void> {
  await platformFetch('/platform-exit-impersonation', {
    method: 'POST',
    body: JSON.stringify({ targetId }),
  })
}
