import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { db, type QueuedOperation } from '@/lib/db'
import { supabase } from '@/services/supabase'
import { createMovement } from '@/features/movements/services/movementService'
import { createProduct, updateProduct } from '@/features/products/services/productService'
import { createContact, updateContact } from '@/features/contacts/services/contactService'
import {
  applyInventorySession,
  createInventorySession,
  updateCount,
} from '@/features/inventory/services/inventoryService'
import {
  createLocation,
  updateLocation,
  setDefaultLocation,
} from '@/features/locations/services/locationService'
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/features/products/services/categoryService'
import { pullSync } from '@/features/offline/services/syncService'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { MovementType } from '@/types'

const SYNC_META_ID = 'global'
const MAX_RETRIES = 5
const MAX_BACKOFF_MS = 5 * 60 * 1000

async function isOnlineAndAuthenticated(): Promise<boolean> {
  // This helper checks both browser connectivity and the presence of a valid Supabase session.
  if (!navigator.onLine) return false
  try {
    const { error } = await supabase.auth.getSession()
    return !error
  } catch {
    return false
  }
}

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
  const [lastError, setLastError] = useState<Error | null>(null)
  const [deadCount, setDeadCount] = useState(0)
  const syncRunRef = useRef<Promise<void> | null>(null)

  // On mount: recover any operations stuck in 'syncing' from a previous session.
  // Mark them as failed so the retry/backoff logic re-evaluates them instead of
  // immediately replaying potentially non-idempotent operations.
  useEffect(() => {
    void db.pendingOperations.where('status').equals('syncing').modify({ status: 'failed' })
  }, [])

  const sync = useCallback(async () => {
    if (!online || !session) return

    // Serialize concurrent sync attempts using a module-level promise.
    if (syncRunRef.current) {
      await syncRunRef.current
      return
    }

    const run = (async () => {
      const reachable = await isOnlineAndAuthenticated()
      if (!reachable) return

      const orgId = session.membership.orgId
      if (!orgId) return

      setIsSyncing(true)
      let pullSuccess = false
      let syncError: Error | null = null
      const now = Date.now()

      try {
        await db.syncMeta.put({
          id: SYNC_META_ID,
          lastSyncAt: now,
          status: 'syncing',
        })

        const pending = await db.pendingOperations
          .where('status')
          .anyOf('pending', 'failed')
          .sortBy('createdAt')

        const ready = pending.filter((op) => !op.nextRetryAt || op.nextRetryAt <= now)
        const tempToRealId = new Map<string, string>()

        for (const op of ready) {
          // Skip operations that belong to a different organization than the current one.
          const opOrgId = getPayloadOrgId(op.payload)
          if (opOrgId !== undefined && opOrgId !== orgId) {
            continue
          }

          await db.pendingOperations.update(op.id, { status: 'syncing' })

          try {
            await executeOperation(op, orgId, tempToRealId)
            await db.pendingOperations.delete(op.id)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Erreur inconnue'
            const isRetryable = err instanceof Error && isRetryableError(err)
            const retryCount = op.retryCount + 1
            const status = !isRetryable || retryCount >= MAX_RETRIES ? 'dead' : 'failed'
            const nextRetryAt =
              status === 'failed'
                ? Date.now() + Math.min(2 ** retryCount * 1000, MAX_BACKOFF_MS)
                : undefined

            await db.pendingOperations.update(op.id, {
              status,
              error: message,
              retryCount,
              nextRetryAt,
            })

            if (status === 'dead') {
              syncError = err instanceof Error ? err : new Error(message)
            }
          }
        }

        try {
          await pullSync(orgId)
          pullSuccess = true
        } catch (err) {
          console.error('Pull sync failed', err)
          pullSuccess = false
          syncError = err instanceof Error ? err : new Error('Pull sync failed')
        }

        // Refetch in the background instead of invalidating. Invalidation wipes
        // cached data immediately, which clears lists, resets forms, and hides
        // dialogs while the request is in flight. refetch keeps existing UI state.
        const keys: readonly (readonly unknown[])[] = [
          ['products', orgId],
          ['categories', orgId],
          ['locations', orgId],
          ['stock', orgId],
          ['movements', orgId],
          ['contacts', orgId],
          ['inventory-sessions', orgId],
          ['team-users', orgId],
          ['invitations', orgId],
          ['my-invitations'],
        ]
        for (const key of keys) {
          try {
            // Only refetch if the query is active (mounted). Inactive pages will
            // pick up fresh data the next time they are visited.
            if (queryClient.getQueryCache().find({ queryKey: key })?.isActive()) {
              void queryClient.refetchQueries({ queryKey: key })
            }
          } catch (err) {
            console.error('Failed to refetch cache', key, err)
          }
        }

        // Inventory counts are cached per-session, so refetch active ones.
        try {
          const activeCountQueries = queryClient
            .getQueryCache()
            .findAll({ predicate: (query) => query.queryKey[0] === 'inventory-counts' })
            .filter((q) => q.isActive())
          for (const query of activeCountQueries) {
            void queryClient.refetchQueries({ queryKey: query.queryKey })
          }
        } catch (err) {
          console.error('Failed to refetch inventory-counts caches', err)
        }

        // Only claim a successful sync if both push and pull succeeded.
        if (pullSuccess) {
          await db.syncMeta.put({
            id: SYNC_META_ID,
            lastSyncAt: Date.now(),
            status: 'idle',
          })
        } else {
          await db.syncMeta.put({
            id: SYNC_META_ID,
            lastSyncAt: now,
            status: 'error',
          })
        }

        const dead = await db.pendingOperations.where('status').equals('dead').count()
        setDeadCount(dead)
        setLastError(syncError)
      } finally {
        setIsSyncing(false)
      }
    })()

    syncRunRef.current = run
    try {
      await run
    } finally {
      syncRunRef.current = null
    }
  }, [online, session, queryClient])

  useEffect(() => {
    if (!online) return

    // Defer the first sync so app startup / page transitions are not blocked.
    const initialTimer = setTimeout(() => {
      void sync()
    }, 5000)

    // Sync periodically, but at a low frequency to avoid interrupting the user.
    const interval = setInterval(() => {
      void sync()
    }, 60 * 1000)

    return () => {
      clearTimeout(initialTimer)
      clearInterval(interval)
    }
  }, [online, sync])

  const retryDead = useCallback(async () => {
    const dead = await db.pendingOperations.where('status').equals('dead').toArray()
    if (dead.length === 0) return
    await db.pendingOperations.bulkUpdate(
      dead.map((op) => ({
        key: op.id,
        changes: { status: 'failed', retryCount: 0, nextRetryAt: undefined, error: undefined },
      }))
    )
    setDeadCount(0)
    void sync()
  }, [sync])

  return { sync, isSyncing, online, lastError, deadCount, retryDead }
}

function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase()
  // 4xx client errors are generally not retryable.
  if (/\b4\d{2}\b/.test(err.message)) return false
  if (msg.includes('forbidden') || msg.includes('unauthorized') || msg.includes('not found'))
    return false
  if (msg.includes('invalid request') || msg.includes('validation')) return false
  // Business validation errors that will not be fixed by retrying.
  if (msg.includes('stock insuffisant')) return false
  if (msg.includes('opérateur non trouvé') || msg.includes('operator not found')) return false
  // Network errors, timeouts, and 5xx are retryable.
  return true
}

async function executeOperation(
  op: QueuedOperation,
  currentOrgId: string,
  tempToRealId: Map<string, string>
): Promise<void> {
  switch (op.type) {
    case 'MOVEMENT': {
      const payload = op.payload as {
        orgId?: string
        productId: string
        locationId: string
        targetLocationId?: string | null
        type: MovementType
        quantity: number
        reason?: string | null
        contactId?: string | null
      }
      await createMovement({
        orgId: payload.orgId ?? currentOrgId,
        productId: mapTempId(tempToRealId, payload.productId),
        locationId: mapTempId(tempToRealId, payload.locationId),
        targetLocationId: payload.targetLocationId
          ? mapTempId(tempToRealId, payload.targetLocationId)
          : payload.targetLocationId,
        type: payload.type,
        quantity: payload.quantity,
        reason: payload.reason ?? null,
        contactId: payload.contactId ?? null,
      })
      return
    }

    case 'PRODUCT_CREATE': {
      const payload = op.payload as {
        orgId: string
        input: Parameters<typeof createProduct>[1] & { tempId?: string }
      }
      const created = await createProduct(payload.orgId, payload.input)
      if (created.id && payload.input.tempId) {
        tempToRealId.set(payload.input.tempId, created.id)
      }
      return
    }

    case 'PRODUCT_UPDATE': {
      const payload = op.payload as {
        orgId: string
        id: string
        input: Parameters<typeof updateProduct>[2]
      }
      const realId = mapTempId(tempToRealId, payload.id)
      await updateProduct(realId, payload.orgId, payload.input)
      return
    }

    case 'CONTACT_CREATE': {
      const payload = op.payload as {
        orgId: string
        input: Parameters<typeof createContact>[1] & { tempId?: string }
      }
      const created = await createContact(payload.orgId, payload.input)
      if (created.id && payload.input.tempId) {
        tempToRealId.set(payload.input.tempId, created.id)
      }
      return
    }

    case 'CONTACT_UPDATE': {
      const payload = op.payload as {
        orgId: string
        id: string
        input: Parameters<typeof updateContact>[2]
      }
      const realId = mapTempId(tempToRealId, payload.id)
      await updateContact(realId, payload.orgId, payload.input)
      return
    }

    case 'INVENTORY': {
      const payload = op.payload as { orgId: string; sessionId: string }
      await applyInventorySession(payload.sessionId)
      return
    }

    case 'INVENTORY_COUNT_UPDATE': {
      const payload = op.payload as {
        orgId: string
        countId: string
        countedQuantity: number
      }
      await updateCount(payload.countId, payload.countedQuantity)
      return
    }

    case 'INVENTORY_SESSION_CREATE': {
      const payload = op.payload as {
        orgId: string
        locationId: string
        name: string
        operatorId: string
      }
      await createInventorySession(
        payload.orgId,
        payload.locationId,
        payload.name,
        payload.operatorId
      )
      return
    }

    case 'LOCATION_CREATE': {
      const payload = op.payload as {
        orgId: string
        input: Parameters<typeof createLocation>[1]
      }
      await createLocation(payload.orgId, payload.input)
      return
    }

    case 'LOCATION_UPDATE': {
      const payload = op.payload as {
        orgId: string
        id: string
        input: Parameters<typeof updateLocation>[2]
      }
      await updateLocation(payload.id, payload.orgId, payload.input)
      return
    }

    case 'LOCATION_SET_DEFAULT': {
      const payload = op.payload as { id: string; orgId: string }
      await setDefaultLocation(payload.id, payload.orgId)
      return
    }

    case 'CATEGORY_CREATE': {
      const payload = op.payload as { orgId: string; name: string }
      await createCategory(payload.orgId, payload.name)
      return
    }

    case 'CATEGORY_UPDATE': {
      const payload = op.payload as { orgId: string; id: string; name: string }
      await updateCategory(payload.id, payload.orgId, payload.name)
      return
    }

    case 'CATEGORY_DELETE': {
      const payload = op.payload as { orgId: string; id: string }
      await deleteCategory(payload.id, payload.orgId)
      return
    }

    default:
      throw new Error(`Type d'opération inconnu: ${(op as { type: string }).type}`)
  }
}

function mapTempId(tempToRealId: Map<string, string>, id: string): string {
  return tempToRealId.get(id) ?? id
}

function getPayloadOrgId(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const record = payload as Record<string, unknown>
  if (typeof record.orgId === 'string') return record.orgId
  if (record.input && typeof record.input === 'object') {
    const inputOrgId = (record.input as { orgId?: string }).orgId
    if (typeof inputOrgId === 'string') return inputOrgId
  }
  return undefined
}
