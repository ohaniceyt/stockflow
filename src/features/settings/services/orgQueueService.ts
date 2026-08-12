import { edgeFetch } from '@/services/edgeFunctions'

export interface OrgPendingOperation {
  id: string
  clientOperationId: string
  orgId: string
  actorId: string | null
  type: string
  payload: Record<string, unknown>
  status: 'pending' | 'syncing' | 'failed' | 'dead' | 'cancelled' | 'completed'
  retryCount: number
  error: string | null
  nextRetryAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ListOrgPendingOperationsFilters {
  status?: OrgPendingOperation['status']
  limit?: number
  offset?: number
}

export interface PaginatedOrgPendingOperations {
  operations: OrgPendingOperation[]
  total: number
  limit: number
  offset: number
}

function mapServerOperation(row: Record<string, unknown>): OrgPendingOperation {
  const rawActorId = row.actor_id
  const rawPayload = row.payload
  const rawError = row.error
  const rawNextRetryAt = row.next_retry_at
  return {
    id: String(row.id),
    clientOperationId: String(row.client_operation_id),
    orgId: String(row.org_id),
    actorId: typeof rawActorId === 'string' ? rawActorId : null,
    type: String(row.type),
    payload:
      typeof rawPayload === 'object' && rawPayload !== null
        ? (rawPayload as Record<string, unknown>)
        : {},
    status: String(row.status) as OrgPendingOperation['status'],
    retryCount: Number(row.retry_count ?? 0),
    error: typeof rawError === 'string' ? rawError : null,
    nextRetryAt: typeof rawNextRetryAt === 'string' ? rawNextRetryAt : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}

export async function listOrgPendingOperations(
  filters: ListOrgPendingOperationsFilters = {}
): Promise<PaginatedOrgPendingOperations> {
  const params = new URLSearchParams()
  if (filters.status) params.set('status', filters.status)
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.offset !== undefined) params.set('offset', String(filters.offset))

  const queryString = params.toString()
  const functionName = queryString
    ? `list-org-pending-operations?${queryString}`
    : 'list-org-pending-operations'

  const data = await edgeFetch<{
    operations: Record<string, unknown>[]
    total: number
    limit: number
    offset: number
  }>(functionName)

  return {
    operations: data.operations.map(mapServerOperation),
    total: data.total,
    limit: data.limit,
    offset: data.offset,
  }
}

export async function cancelOrgOperation(clientOperationId: string): Promise<void> {
  await edgeFetch('cancel-org-operation', {
    method: 'POST',
    body: JSON.stringify({ client_operation_id: clientOperationId }),
  })
}

export async function resetOrgOperation(clientOperationId: string): Promise<void> {
  await edgeFetch('update-org-pending-operation', {
    method: 'POST',
    body: JSON.stringify({
      client_operation_id: clientOperationId,
      status: 'failed',
      retry_count: 0,
      error: null,
      next_retry_at: null,
    }),
  })
}
