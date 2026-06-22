import { useCallback, useEffect, useState } from 'react'
import { db, type QueuedOperation } from '@/lib/db'
import { recordMovement } from '@/features/stock/services/stockService'
import { createProduct } from '@/features/products/services/productService'
import { applyInventorySession } from '@/features/inventory/services/inventoryService'
import type { MovementType } from '@/types'

const SYNC_META_ID = 'global'

export function useNetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  return online
}

export function useSync() {
  const online = useNetworkStatus()
  const [isSyncing, setIsSyncing] = useState(false)

  const sync = useCallback(async () => {
    if (!online) return

    setIsSyncing(true)
    try {
      const pending = await db.pendingOperations
        .where('status')
        .anyOf('pending', 'failed')
        .sortBy('createdAt')

      for (const op of pending) {
        await db.pendingOperations.update(op.id, { status: 'syncing' })

        try {
          await executeOperation(op)
          await db.pendingOperations.delete(op.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur inconnue'
          await db.pendingOperations.update(op.id, {
            status: 'failed',
            error: message,
            retryCount: op.retryCount + 1,
          })
        }
      }

      await db.syncMeta.put({
        id: SYNC_META_ID,
        lastSyncAt: Date.now(),
        status: 'idle',
      })
    } finally {
      setIsSyncing(false)
    }
  }, [online])

  useEffect(() => {
    if (!online) return
    const timer = setTimeout(() => {
      void sync()
    }, 0)
    return () => clearTimeout(timer)
  }, [online, sync])

  return { sync, isSyncing, online }
}

async function executeOperation(op: QueuedOperation): Promise<void> {
  switch (op.type) {
    case 'MOVEMENT': {
      const payload = op.payload as {
        productId: string
        locationId: string
        targetLocationId?: string | null
        type: MovementType
        quantity: number
        reason?: string | null
      }
      await recordMovement(payload)
      return
    }

    case 'PRODUCT_CREATE': {
      const payload = op.payload as {
        orgId: string
        input: Parameters<typeof createProduct>[1]
      }
      await createProduct(payload.orgId, payload.input)
      return
    }

    case 'INVENTORY': {
      const payload = op.payload as { sessionId: string }
      await applyInventorySession(payload.sessionId)
      return
    }

    default:
      throw new Error(`Type d'opération inconnu: ${String(op.type)}`)
  }
}
