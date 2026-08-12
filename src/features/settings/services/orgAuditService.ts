import { edgeFetch } from '@/services/edgeFunctions'
import type { ActivityLogRow } from '@/features/back-office/types'

export interface ListOrgAuditLogsFilters {
  action?: string
  targetType?: string
  targetId?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
  offset?: number
}

export interface PaginatedActivityLogs {
  logs: ActivityLogRow[]
  total: number
  limit: number
  offset: number
}

export async function listOrgAuditLogs(
  filters: ListOrgAuditLogsFilters = {}
): Promise<PaginatedActivityLogs> {
  const params = new URLSearchParams()
  if (filters.action) params.set('action', filters.action)
  if (filters.targetType) params.set('targetType', filters.targetType)
  if (filters.targetId) params.set('targetId', filters.targetId)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))

  const queryString = params.toString()
  const functionName = queryString
    ? `list-org-activity-logs?${queryString}`
    : 'list-org-activity-logs'

  const data = await edgeFetch<{
    logs: ActivityLogRow[]
    total: number
    limit: number
    offset: number
  }>(functionName)

  return {
    logs: data.logs,
    total: data.total,
    limit: data.limit,
    offset: data.offset,
  }
}
