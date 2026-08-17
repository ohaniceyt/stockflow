/**
 * Shared input validation & sanitization helpers for StockFlow Edge Functions.
 *
 * All user-controlled values should pass through these helpers before being
 * used in database queries, emails, PDFs or JSON responses.
 */

import { getCorsHeaders } from './cors.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const SLUG_RE = /^[a-z0-9-]+$/
const SAFE_SEARCH_RE = /^[\p{L}\p{N}\s'-]+$/u
const PHONE_RE = /^[+\d\s()-]{6,32}$/

export interface ParsedBody<T> {
  ok: true
  body: T
}

export interface ParseError {
  ok: false
  response: Response
}

/**
 * Parse a JSON request body after verifying the Content-Type header.
 * Returns a response-ready error object on invalid content type or malformed JSON.
 */
export async function parseJsonBody<T = unknown>(req: Request): Promise<ParsedBody<T> | ParseError> {
  const contentType = req.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), {
        status: 415,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }),
    }
  }

  try {
    const body = (await req.json()) as T
    return { ok: true, body }
  } catch {
    return {
      ok: false,
      response: new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }),
    }
  }
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}

export function isEmail(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 254 && EMAIL_RE.test(value)
}

export function isPhone(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 32 && PHONE_RE.test(value)
}

export function isSlug(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 2 && value.length <= 50 && SLUG_RE.test(value)
}

export function isString(value: unknown, maxLength?: number): value is string {
  return typeof value === 'string' && (maxLength === undefined || value.length <= maxLength)
}

export function isNonEmptyString(value: unknown, maxLength?: number): value is string {
  return isString(value, maxLength) && value.trim().length > 0
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value)
}

export function isInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value)
}

export function isNonNegativeInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value >= 0
}

export function isPositiveInteger(value: unknown): value is number {
  return isNumber(value) && Number.isInteger(value) && value > 0
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

export function isEnum<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
}

export function isStringArray(value: unknown, maxLength?: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string') &&
    (maxLength === undefined || value.length <= maxLength)
  )
}

export function isUuidArray(value: unknown, maxLength?: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isUuid(item)) &&
    (maxLength === undefined || value.length <= maxLength)
  )
}

/**
 * Validates a simple free-text search term so it can be safely embedded in
 * PostgREST `.ilike()` / `.or()` filter strings. Rejects terms that could
 * alter filter syntax or act as SQL LIKE wildcards.
 */
export function isSafeSearchTerm(value: unknown, maxLength = 100): value is string {
  return typeof value === 'string' && value.length <= maxLength && SAFE_SEARCH_RE.test(value)
}

/**
 * Clamp and validate integer pagination params.
 */
export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback
  const parsed = typeof value === 'number' ? value : parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.max(min, Math.min(max, parsed))
}

/**
 * Sanitize a filename returned by an Edge Function before it is used in a
 * client-side `download` attribute.
 */
export function sanitizeFilename(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback
  return value.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim() || fallback
}

/**
 * Coerce an unknown value to a trimmed string or null.
 */
export function normalizeString(value: unknown): string | null {
  if (value === undefined || value === null) return null
  const str = String(value).trim()
  return str.length > 0 ? str : null
}

/**
 * Coerce an unknown value to a finite number or fallback.
 */
export function normalizeNumber(value: unknown, fallback = 0): number {
  if (value === undefined || value === null) return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Sanitize a string for safe insertion into generated HTML/PDF templates.
 * Replaces `<`, `>`, `&`, `"`, `'` with HTML entities.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
