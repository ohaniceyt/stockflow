import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { requirePlatformAdmin } from '../_shared/platform.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { clampInt, isEnum, isSafeSearchTerm, isUuid } from '../_shared/validate.ts'

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

    const platformAdmin = await requirePlatformAdmin(req, adminClient)
    if (!platformAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const rawSearch = url.searchParams.get('search') ?? undefined
    const rawOrgId = url.searchParams.get('orgId') ?? undefined
    const rawRole = url.searchParams.get('role') ?? undefined
    const rawIsActive = url.searchParams.get('isActive')
    const limit = clampInt(url.searchParams.get('limit'), 1, 100, 20)
    const offset = clampInt(url.searchParams.get('offset'), 0, Number.MAX_SAFE_INTEGER, 0)

    const search = rawSearch ? rawSearch.trim() : undefined
    if (search !== undefined && !isSafeSearchTerm(search)) {
      return new Response(JSON.stringify({ error: 'Invalid search term' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (rawOrgId !== undefined && !isUuid(rawOrgId)) {
      return new Response(JSON.stringify({ error: 'Invalid orgId' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const allowedRoles = ['super_admin', 'admin', 'operator', 'cashier', 'reader'] as const
    if (rawRole !== undefined && !isEnum(rawRole, allowedRoles)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    let query = adminClient.from('users').select(
      `
        id,
        name,
        email,
        phone,
        email_verified,
        active_org_id,
        created_at,
        updated_at,
        organization_memberships!inner (
          id,
          org_id,
          role,
          is_active,
          force_pin_change,
          last_login_at,
          organizations!inner ( id, name, slug )
        )
      `,
      { count: 'exact' }
    )

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    if (rawOrgId !== undefined) {
      query = query.eq('organization_memberships.org_id', rawOrgId)
    }

    if (rawRole !== undefined) {
      query = query.eq('organization_memberships.role', rawRole)
    }

    if (rawIsActive === 'true' || rawIsActive === 'false') {
      query = query.eq('organization_memberships.is_active', rawIsActive === 'true')
    }

    const {
      data: users,
      error,
      count,
    } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    if (error) {
      return genericInternalErrorResponse(req)
    }

    return new Response(JSON.stringify({ users: users ?? [], total: count ?? 0, limit, offset }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
