/**
 * Shared audit logging helpers.
 *
 * Tables:
 *   - activity_logs: org-scoped actions performed by users.
 *   - login_attempts: authentication attempts for brute-force analysis.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getLogger } from './logger.ts'

const logger = getLogger('audit')

const SENSITIVE_DETAIL_KEYS = new Set([
  'password',
  'pin',
  'token',
  'access_token',
  'refresh_token',
  'apikey',
  'api_key',
  'authorization',
  'secret',
  'private_key',
  'email',
  'ip_address',
  'phone',
  'address',
])

function isSensitiveDetailKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_DETAIL_KEYS.has(lower) || /\b(password|token|secret|key|pin|email|phone|address|ssn|iban)\b/.test(lower)
}

function sanitizeDetails(value: unknown): unknown {
  if (typeof value === 'string') {
    if (/^eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_.-]*$/.test(value)) {
      return '[JWT]'
    }
    return value.length > 64 ? '[redacted]' : value
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeDetails)
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSensitiveDetailKey(k) ? '[redacted]' : sanitizeDetails(v)
    }
    return out
  }
  return value
}

export interface ActivityLogInput {
  org_id?: string | null
  actor_id?: string | null
  action: string
  target_type?: string | null
  target_id?: string | null
  details?: Record<string, unknown> | null
  ip_address?: string | null
}

export async function logActivity(
  adminClient: ReturnType<typeof createClient>,
  input: ActivityLogInput
): Promise<void> {
  if (!input.org_id) {
    // Some actions (e.g. platform admin) may not have an org; skip org-scoped table.
    return
  }

  const { error } = await adminClient.from('activity_logs').insert({
    org_id: input.org_id,
    actor_id: input.actor_id ?? null,
    action: input.action,
    target_type: input.target_type ?? null,
    target_id: input.target_id ?? null,
    details: sanitizeDetails(input.details) ?? null,
    ip_address: input.ip_address ?? null,
  })

  if (error) {
    logger.error('activity_log_write_failed', { org_id: input.org_id, action: input.action }, error)
  }
}

export interface LoginAttemptInput {
  ip_address?: string | null
  user_id?: string | null
  succeeded: boolean
}

export async function logLoginAttempt(
  adminClient: ReturnType<typeof createClient>,
  input: LoginAttemptInput
): Promise<void> {
  const { error } = await adminClient.from('login_attempts').insert({
    ip_address: input.ip_address ?? null,
    user_id: input.user_id ?? null,
    succeeded: input.succeeded,
  })

  if (error) {
    logger.error('login_attempt_write_failed', { user_id: input.user_id, succeeded: input.succeeded }, error)
  }
}
