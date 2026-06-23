import { db } from '@/lib/db'
import type { PendingOperation } from '@/types'

export interface QueueOperationInput {
  type: PendingOperation['type']
  payload: unknown
}

export async function queueOperation(input: QueueOperationInput): Promise<PendingOperation> {
  const now = Date.now()
  const op: PendingOperation = {
    id: crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    createdAt: now,
    retryCount: 0,
    status: 'pending',
  }

  await db.pendingOperations.add(op)
  return op
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  return db.pendingOperations.where('status').anyOf('pending', 'failed').sortBy('createdAt')
}
