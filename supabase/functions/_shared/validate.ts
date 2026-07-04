/**
 * Shared input validation helpers for StockFlow Edge Functions.
 *
 * These helpers are intentionally strict: they reject rather than coerce.
 * Use them at the top of each Edge Function handler to fail fast on bad input.
 */

export interface ValidationError {
  field: string
  message: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value)
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isInteger(value)
}

export function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

export function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 2 && value.length <= 60 && SLUG_RE.test(value)
}

export function isInEnum(value: unknown, allowed: readonly string[]): boolean {
  return typeof value === 'string' && allowed.includes(value)
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function sanitizeString(value: unknown, maxLength = 255): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length === 0) return null
  if (trimmed.length > maxLength) return trimmed.slice(0, maxLength)
  return trimmed
}

export function parsePositiveInt(value: unknown, defaultValue: number, max = 1000): number {
  const num = typeof value === 'string' ? Number.parseInt(value, 10) : typeof value === 'number' ? value : NaN
  if (Number.isNaN(num) || !Number.isInteger(num) || num <= 0) return defaultValue
  return Math.min(num, max)
}

export function validateRequiredUuid(value: unknown, field: string): ValidationError | null {
  if (!isUuid(value)) return { field, message: `${field} must be a valid UUID` }
  return null
}

export function validateRequiredString(value: unknown, field: string, maxLength = 255): ValidationError | null {
  if (!isNonEmptyString(value)) return { field, message: `${field} is required` }
  if (value.length > maxLength) return { field, message: `${field} exceeds ${maxLength} characters` }
  return null
}

export function validateEmail(value: unknown, field: string): ValidationError | null {
  if (!isEmail(value)) return { field, message: `${field} must be a valid email` }
  return null
}

export function validateEnum(
  value: unknown,
  field: string,
  allowed: readonly string[]
): ValidationError | null {
  if (!isInEnum(value, allowed)) {
    return { field, message: `${field} must be one of ${allowed.join(', ')}` }
  }
  return null
}

export function validatePagination(params: Record<string, unknown>): {
  page: number
  limit: number
  errors: ValidationError[]
} {
  const errors: ValidationError[] = []
  const page = parsePositiveInt(params.page, 1, 1000)
  const limit = parsePositiveInt(params.limit, 20, 100)
  if (page !== Number(params.page ?? 1) && params.page !== undefined) {
    errors.push({ field: 'page', message: 'page must be a positive integer' })
  }
  if (limit !== Number(params.limit ?? 20) && params.limit !== undefined) {
    errors.push({ field: 'limit', message: 'limit must be a positive integer ≤ 100' })
  }
  return { page, limit, errors }
}

/**
 * Run a list of validation functions and return the first error, or null if all pass.
 */
export function validateAll(...validators: Array<() => ValidationError | null>): ValidationError | null {
  for (const validator of validators) {
    const error = validator()
    if (error) return error
  }
  return null
}
