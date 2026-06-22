import { useCallback } from 'react'
import { db } from '@/lib/db'
import type { MovementType } from '@/types'

export function useOfflineMutations() {
  const queueMovement = useCallback(
    async (payload: {
      productId: string
      locationId: string
      targetLocationId?: string | null
      type: MovementType
      quantity: number
      reason?: string | null
    }) => {
      await db.pendingOperations.add({
        id: crypto.randomUUID(),
        type: 'MOVEMENT',
        payload,
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      })
    },
    []
  )

  const queueProductCreate = useCallback(
    async (
      orgId: string,
      input: Parameters<
        typeof import('@/features/products/services/productService').createProduct
      >[1]
    ) => {
      await db.pendingOperations.add({
        id: crypto.randomUUID(),
        type: 'PRODUCT_CREATE',
        payload: { orgId, input },
        createdAt: Date.now(),
        retryCount: 0,
        status: 'pending',
      })
    },
    []
  )

  const queueInventoryApply = useCallback(async (sessionId: string) => {
    await db.pendingOperations.add({
      id: crypto.randomUUID(),
      type: 'INVENTORY',
      payload: { sessionId },
      createdAt: Date.now(),
      retryCount: 0,
      status: 'pending',
    })
  }, [])

  return { queueMovement, queueProductCreate, queueInventoryApply }
}
