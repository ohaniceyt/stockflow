import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { getLogger } from '../_shared/logger.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  const log = getLogger('cleanup-audit-logs')

  try {
    const cronSecret = Deno.env.get('CRON_SECRET')
    const providedSecret = req.headers.get('x-cron-secret')

    if (!cronSecret || providedSecret !== cronSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const retentionDays = 90
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await adminClient
      .rpc('cleanup_old_audit_logs', {
        p_older_than_days: retentionDays,
      })
      .single()

    if (error) {
      throw new Error(error.message)
    }

    const row = (data ?? {}) as Record<string, number | null>
    const deletedActivity = row.deleted_activity_logs ?? 0
    const deletedPlatform = row.deleted_platform_audit_logs ?? 0
    log.info('audit_logs_cleaned', {
      retention_days: retentionDays,
      cutoff,
      deleted_activity_logs: deletedActivity,
      deleted_platform_audit_logs: deletedPlatform,
    })

    return new Response(
      JSON.stringify({
        success: true,
        message: `Audit logs older than ${retentionDays} days cleaned`,
        cutoff,
        deleted_activity_logs: deletedActivity,
        deleted_platform_audit_logs: deletedPlatform,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    log.error('cleanup_audit_logs_failed', {}, err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
