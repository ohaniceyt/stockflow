import { db } from '@/lib/db'
import type { PendingOperation } from '@/types'

export interface QueueOperationInput {
  type: PendingOperation['type']
  payload: unknown
}

export async function queueOperation(input: QueueOperationInput): Promise<PendingOperation> {
  const op: PendingOperation = {
    id: crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  }

  await db.pendingOperations.add({
    id: op.id,
    type: op.type,
    payload: op.payload,
    createdAt: Date.now(),
    retryCount: 0,
    status: 'pending',
  })

  return op
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  const rows = await db.pendingOperations.where('status').anyOf('pending', 'failed').toArray()
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: r.payload,
    createdAt: new Date(r.createdAt).toISOString(),
    retryCount: r.retryCount,
    status: r.status,
    error: r.error,
  }))
}
