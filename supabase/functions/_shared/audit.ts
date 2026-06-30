/**
 * Shared audit logging helpers.
 *
 * Tables:
 *   - activity_logs: org-scoped actions performed by users.
 *   - login_attempts: authentication attempts for brute-force analysis.
 */

import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

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
    details: input.details ?? null,
    ip_address: input.ip_address ?? null,
  })

  if (error) {
    console.error('Failed to write activity log:', error)
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
    console.error('Failed to write login attempt:', error)
  }
}
