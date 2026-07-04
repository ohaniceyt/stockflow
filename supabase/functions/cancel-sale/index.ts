import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { logActivity } from '../_shared/audit.ts'

interface CancelSalePayload {
  receipt_id?: string | null
  movement_id?: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return corsResponse(req)
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error('Missing Supabase env vars')
    }

    const token = getBearerToken(req)
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const payload: CancelSalePayload = await req.json()

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    if (!payload.receipt_id && !payload.movement_id) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { error } = await userClient.rpc('cancel_sale', {
      p_receipt_id: payload.receipt_id ?? null,
      p_movement_id: payload.movement_id ?? null,
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    // Resolve org context for audit logging (service role read, caller has already been authorized by RPC).
    const { data: receipt } = payload.receipt_id
      ? await adminClient
          .from('receipts')
          .select('id, org_id, total_amount, currency')
          .eq('id', payload.receipt_id)
          .maybeSingle()
      : { data: null }

    const { data: movement } =
      !receipt && payload.movement_id
        ? await adminClient
            .from('movements')
            .select('id, org_id, reference_id')
            .eq('id', payload.movement_id)
            .maybeSingle()
        : { data: null }

    const orgId = receipt?.org_id ?? movement?.org_id
    if (orgId) {
      await logActivity(adminClient, {
        org_id: orgId,
        actor_id: claims.sub,
        action: 'sale_cancelled',
        target_type: 'receipt',
        target_id: payload.receipt_id ?? movement?.reference_id ?? null,
        details: {
          receipt_id: payload.receipt_id,
          movement_id: payload.movement_id,
          total_amount: receipt?.total_amount,
          currency: receipt?.currency,
        },
        ip_address: req.headers.get('x-forwarded-for') ?? null,
      })
    }

    return new Response(JSON.stringify({ success: true }), {
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
