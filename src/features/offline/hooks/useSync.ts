import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db, type QueuedOperation } from '@/lib/db'
import { recordMovement } from '@/features/stock/services/stockService'
import { createProduct, updateProduct } from '@/features/products/services/productService'
import { applyInventorySession, updateCount } from '@/features/inventory/services/inventoryService'
import { pullSync } from '@/features/offline/services/syncService'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { MovementType } from '@/types'

const SYNC_META_ID = 'global'
const MAX_RETRIES = 5
const MAX_BACKOFF_MS = 5 * 60 * 1000

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
  const { session } = useAuth()
  const online = useNetworkStatus()
  const queryClient = useQueryClient()
  const [isSyncing, setIsSyncing] = useState(false)

  const sync = useCallback(async () => {
    if (!online || !session) return

    setIsSyncing(true)
    try {
      await db.syncMeta.put({
        id: SYNC_META_ID,
        lastSyncAt: Date.now(),
        status: 'syncing',
      })

      const now = Date.now()
      const pending = await db.pendingOperations
        .where('status')
        .anyOf('pending', 'failed')
        .sortBy('createdAt')

      const ready = pending.filter((op) => !op.nextRetryAt || op.nextRetryAt <= now)

      for (const op of ready) {
        await db.pendingOperations.update(op.id, { status: 'syncing' })

        try {
          await executeOperation(op)
          await db.pendingOperations.delete(op.id)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Erreur inconnue'
          const retryCount = op.retryCount + 1
          const status = retryCount >= MAX_RETRIES ? 'dead' : 'failed'
          const nextRetryAt = Date.now() + Math.min(2 ** retryCount * 1000, MAX_BACKOFF_MS)

          await db.pendingOperations.update(op.id, {
            status,
            error: message,
            retryCount,
            nextRetryAt,
          })
        }
      }

      try {
        await pullSync(session.membership.orgId)
      } catch (err) {
        console.error('Pull sync failed', err)
      }

      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['locations'] })
      void queryClient.invalidateQueries({ queryKey: ['stock'] })
      void queryClient.invalidateQueries({ queryKey: ['movements'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-counts'] })

      await db.syncMeta.put({
        id: SYNC_META_ID,
        lastSyncAt: Date.now(),
        status: 'idle',
      })
    } finally {
      setIsSyncing(false)
    }
  }, [online, session, queryClient])

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

    case 'PRODUCT_UPDATE': {
      const payload = op.payload as {
        id: string
        input: Parameters<typeof updateProduct>[1]
      }
      await updateProduct(payload.id, payload.input)
      return
    }

    case 'INVENTORY_COUNT_UPDATE': {
      const payload = op.payload as {
        countId: string
        countedQuantity: number
      }
      await updateCount(payload.countId, payload.countedQuantity)
      return
    }

    default:
      throw new Error(`Type d'opération inconnu: ${op.type}`)
  }
}
