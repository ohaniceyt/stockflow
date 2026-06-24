import type { PlatformAuditLog, UserRole } from '@/types'

export interface PlatformOverview {
  organizationsTotal: number
  organizationsActive: number
  usersTotal: number
  usersOnline: number
  movementsToday: number
  subscriptionsByPlan: Record<string, number>
  recentActivity: PlatformAuditLog[]
}

export interface Paginated<T> {
  data: T[]
  total: number
  limit: number
  offset: number
}

export interface BackOfficeOrganization {
  id: string
  name: string
  slug: string
  currency: string
  timezone: string
  is_active: boolean
  is_suspended: boolean
  suspension_reason: string | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
  subscriptions:
    | {
        plan_id: string
        status: string
        current_period_ends_at: string
      }
    | {
        plan_id: string
        status: string
        current_period_ends_at: string
      }[]
    | null
  organization_memberships: { count: number }[]
  users_count?: number
  products_count?: number
  locations_count?: number
}

export interface BackOfficeMembership {
  id: string
  org_id: string
  role: UserRole
  is_active: boolean
  force_pin_change: boolean
  last_login_at: string | null
  created_at: string
  organizations: { id: string; name: string; slug: string } | null
}

export interface BackOfficeUser {
  id: string
  name: string
  email: string
  phone: string | null
  email_verified: boolean
  active_org_id: string | null
  created_at: string
  updated_at: string
  organization_memberships: BackOfficeMembership[]
}

export interface ActivityLogRow {
  id: string
  action: string
  actor_id: string | null
  target_type: string | null
  target_id: string | null
  details: unknown
  created_at: string
  users?: { name: string | null } | null
}

export interface LoginAttemptRow {
  succeeded: boolean
  created_at: string
}

export type PlatformAuditLogRow = PlatformAuditLog
