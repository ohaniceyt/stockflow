import { db } from '@/lib/db'
import type { PendingOperation, StockLevel } from '@/types'

export interface QueueOperationInput {
  type: PendingOperation['type']
  payload: unknown
}

const SYNC_SECRET =
  (import.meta.env.VITE_SYNC_SECRET as string | undefined) ??
  'stockflow-offline-sync-fallback-secret'

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(input))
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function computeChecksum(
  type: PendingOperation['type'],
  payload: unknown,
  createdAt: number
): Promise<string> {
  const body = `${type}:${SYNC_SECRET}:${JSON.stringify(payload)}:${String(createdAt)}`
  return sha256(body)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(payload: unknown, key: string): string | undefined {
  if (!isPlainObject(payload)) return undefined
  const value = payload[key]
  return typeof value === 'string' ? value : undefined
}

function getNumber(payload: unknown, key: string): number | undefined {
  if (!isPlainObject(payload)) return undefined
  const value = payload[key]
  return typeof value === 'number' ? value : undefined
}

function getInput(payload: unknown): Record<string, unknown> | undefined {
  if (!isPlainObject(payload)) return undefined
  const input = payload.input
  return isPlainObject(input) ? input : undefined
}

export function validateOperation(input: QueueOperationInput): void {
  const { type, payload } = input

  if (!isPlainObject(payload)) {
    throw new Error(`Invalid payload for ${type}: expected an object`)
  }

  switch (type) {
    case 'MOVEMENT': {
      const orgId = getString(payload, 'orgId')
      const productId = getString(payload, 'productId')
      const locationId = getString(payload, 'locationId')
      const movementType = getString(payload, 'type')
      const quantity = getNumber(payload, 'quantity')
      if (!orgId) throw new Error('MOVEMENT requires orgId')
      if (!productId) throw new Error('MOVEMENT requires productId')
      if (!locationId) throw new Error('MOVEMENT requires locationId')
      if (!movementType) throw new Error('MOVEMENT requires type')
      if (quantity === undefined || quantity <= 0)
        throw new Error('MOVEMENT requires positive quantity')
      break
    }

    case 'PRODUCT_CREATE': {
      const orgId = getString(payload, 'orgId')
      const input = getInput(payload)
      if (!orgId) throw new Error('PRODUCT_CREATE requires orgId')
      if (!input?.name) throw new Error('PRODUCT_CREATE requires input.name')
      break
    }

    case 'PRODUCT_UPDATE': {
      const orgId = getString(payload, 'orgId')
      const id = getString(payload, 'id')
      const input = getInput(payload)
      if (!orgId) throw new Error('PRODUCT_UPDATE requires orgId')
      if (!id) throw new Error('PRODUCT_UPDATE requires id')
      if (!input) throw new Error('PRODUCT_UPDATE requires input')
      break
    }

    case 'CONTACT_CREATE': {
      const orgId = getString(payload, 'orgId')
      const input = getInput(payload)
      if (!orgId) throw new Error('CONTACT_CREATE requires orgId')
      if (!input?.name) throw new Error('CONTACT_CREATE requires input.name')
      if (!input.type) throw new Error('CONTACT_CREATE requires input.type')
      break
    }

    case 'CONTACT_UPDATE': {
      const orgId = getString(payload, 'orgId')
      const id = getString(payload, 'id')
      const input = getInput(payload)
      if (!orgId) throw new Error('CONTACT_UPDATE requires orgId')
      if (!id) throw new Error('CONTACT_UPDATE requires id')
      if (!input) throw new Error('CONTACT_UPDATE requires input')
      break
    }

    case 'LOCATION_CREATE': {
      const orgId = getString(payload, 'orgId')
      const input = getInput(payload)
      if (!orgId) throw new Error('LOCATION_CREATE requires orgId')
      if (!input?.name) throw new Error('LOCATION_CREATE requires input.name')
      break
    }

    case 'LOCATION_UPDATE': {
      const orgId = getString(payload, 'orgId')
      const id = getString(payload, 'id')
      const input = getInput(payload)
      if (!orgId) throw new Error('LOCATION_UPDATE requires orgId')
      if (!id) throw new Error('LOCATION_UPDATE requires id')
      if (!input) throw new Error('LOCATION_UPDATE requires input')
      break
    }

    case 'LOCATION_SET_DEFAULT': {
      const orgId = getString(payload, 'orgId')
      const id = getString(payload, 'id')
      if (!orgId) throw new Error('LOCATION_SET_DEFAULT requires orgId')
      if (!id) throw new Error('LOCATION_SET_DEFAULT requires id')
      break
    }

    case 'CATEGORY_CREATE': {
      const orgId = getString(payload, 'orgId')
      const name = getString(payload, 'name')
      if (!orgId) throw new Error('CATEGORY_CREATE requires orgId')
      if (!name) throw new Error('CATEGORY_CREATE requires name')
      break
    }

    case 'CATEGORY_UPDATE': {
      const orgId = getString(payload, 'orgId')
      const id = getString(payload, 'id')
      const name = getString(payload, 'name')
      if (!orgId) throw new Error('CATEGORY_UPDATE requires orgId')
      if (!id) throw new Error('CATEGORY_UPDATE requires id')
      if (!name) throw new Error('CATEGORY_UPDATE requires name')
      break
    }

    case 'CATEGORY_DELETE': {
      const orgId = getString(payload, 'orgId')
      const id = getString(payload, 'id')
      if (!orgId) throw new Error('CATEGORY_DELETE requires orgId')
      if (!id) throw new Error('CATEGORY_DELETE requires id')
      break
    }

    case 'INVENTORY': {
      const sessionId = getString(payload, 'sessionId')
      if (!sessionId) throw new Error('INVENTORY requires sessionId')
      break
    }

    case 'INVENTORY_COUNT_UPDATE': {
      const countId = getString(payload, 'countId')
      const countedQuantity = getNumber(payload, 'countedQuantity')
      if (!countId) throw new Error('INVENTORY_COUNT_UPDATE requires countId')
      if (countedQuantity === undefined)
        throw new Error('INVENTORY_COUNT_UPDATE requires countedQuantity')
      break
    }

    case 'INVENTORY_SESSION_CREATE': {
      const orgId = getString(payload, 'orgId')
      const locationId = getString(payload, 'locationId')
      const name = getString(payload, 'name')
      const operatorId = getString(payload, 'operatorId')
      if (!orgId) throw new Error('INVENTORY_SESSION_CREATE requires orgId')
      if (!locationId) throw new Error('INVENTORY_SESSION_CREATE requires locationId')
      if (!name) throw new Error('INVENTORY_SESSION_CREATE requires name')
      if (!operatorId) throw new Error('INVENTORY_SESSION_CREATE requires operatorId')
      break
    }

    default:
      throw new Error(`Unsupported operation type: ${(input as { type: string }).type}`)
  }
}

async function resolveLocalUpdatedAt(input: QueueOperationInput): Promise<number | undefined> {
  if (input.type !== 'MOVEMENT' || !isPlainObject(input.payload)) return undefined

  const payload = input.payload as {
    productId?: string
    locationId?: string
  }
  const productId = payload.productId
  const locationId = payload.locationId
  if (!productId || !locationId) return undefined

  const current = await db.stockLevels
    .where('productId')
    .equals(productId)
    .and((level: StockLevel) => level.locationId === locationId)
    .first()

  if (current?.updatedAt) {
    return new Date(current.updatedAt).getTime()
  }

  const product = await db.products.get(productId)
  if (product?.updatedAt) {
    return new Date(product.updatedAt).getTime()
  }

  return undefined
}

export async function queueOperation(input: QueueOperationInput): Promise<PendingOperation> {
  validateOperation(input)

  const now = Date.now()
  const localUpdatedAt = await resolveLocalUpdatedAt(input)
  const checksum = await computeChecksum(input.type, input.payload, now)

  const op: PendingOperation = {
    id: crypto.randomUUID(),
    type: input.type,
    payload: input.payload,
    createdAt: now,
    retryCount: 0,
    status: 'pending',
    checksum,
    localUpdatedAt,
  }

  await db.pendingOperations.add(op)
  return op
}

export async function getPendingOperations(): Promise<PendingOperation[]> {
  return db.pendingOperations.where('status').anyOf('pending', 'failed').sortBy('createdAt')
}
