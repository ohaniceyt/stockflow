import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface Payload {
  orgId: string
  newSlug: string
}

const SLUG_RE = /^[a-z0-9-]+$/
const SLUG_MIN = 2
const SLUG_MAX = 50

function normalizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing Supabase env vars')
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const platformAdmin = await requirePlatformAdmin(req, adminClient, 'super_admin', true)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { orgId, newSlug: rawNewSlug }: Payload = await req.json()
    const newSlug = normalizeSlug(rawNewSlug ?? '')

    if (!orgId) {
      return new Response(JSON.stringify({ error: 'orgId is required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }
    if (
      !newSlug ||
      newSlug.length < SLUG_MIN ||
      newSlug.length > SLUG_MAX ||
      !SLUG_RE.test(newSlug)
    ) {
      return new Response(
        JSON.stringify({
          error: `Slug must be ${SLUG_MIN}-${SLUG_MAX} lowercase letters, numbers, or hyphens.`,
        }),
        { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Ensure target slug is not currently used.
    const { data: existingOrg, error: existingError } = await adminClient
      .from('organizations')
      .select('id')
      .eq('slug', newSlug)
      .neq('id', orgId)
      .maybeSingle()

    if (existingError) throw existingError
    if (existingOrg) {
      return new Response(JSON.stringify({ error: 'Slug is already in use' }), {
        status: 409,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Ensure target slug is not an old slug of another org.
    const { data: historyConflict, error: historyError } = await adminClient
      .from('organization_slug_history')
      .select('org_id')
      .eq('new_slug', newSlug)
      .neq('org_id', orgId)
      .maybeSingle()

    if (historyError) throw historyError
    if (historyConflict) {
      return new Response(
        JSON.stringify({ error: 'Slug was previously used by another organization' }),
        { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    // Fetch current slug.
    const { data: org, error: orgError } = await adminClient
      .from('organizations')
      .select('id, slug')
      .eq('id', orgId)
      .single()

    if (orgError) throw orgError
    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const oldSlug = org.slug
    if (oldSlug === newSlug) {
      return new Response(JSON.stringify({ success: true, slug: newSlug, unchanged: true }), {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Update org and record history atomically via transaction-ish sequence.
    const { error: updateError } = await adminClient
      .from('organizations')
      .update({ slug: newSlug, updated_at: new Date().toISOString() })
      .eq('id', orgId)

    if (updateError) throw updateError

    const { error: historyInsertError } = await adminClient
      .from('organization_slug_history')
      .insert({
        org_id: orgId,
        old_slug: oldSlug,
        new_slug: newSlug,
        changed_by: platformAdmin.authUserId,
        changed_at: new Date().toISOString(),
      })

    if (historyInsertError) throw historyInsertError

    await adminClient.from('platform_audit_logs').insert({
      actor_id: platformAdmin.authUserId,
      actor_role: platformAdmin.role,
      action: 'org_slug_changed',
      target_type: 'organization',
      target_id: orgId,
      metadata: { old_slug: oldSlug, new_slug: newSlug },
    })

    return new Response(JSON.stringify({ success: true, orgId, oldSlug, newSlug }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
