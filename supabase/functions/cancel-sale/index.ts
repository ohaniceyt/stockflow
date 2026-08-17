import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isUuid } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { logActivity } from '../_shared/audit.ts'

interface Payload {
  receipt_id?: unknown
  movement_id?: unknown
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

    const parsed = await parseJsonBody<Payload>(req)
    if (!parsed.ok) {
      return parsed.response
    }

    const { receipt_id, movement_id } = parsed.body
    const hasReceipt = receipt_id !== undefined && receipt_id !== null
    const hasMovement = movement_id !== undefined && movement_id !== null

    if (!hasReceipt && !hasMovement) {
      return new Response(JSON.stringify({ error: 'receipt_id or movement_id required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (hasReceipt && !isUuid(receipt_id)) {
      return new Response(JSON.stringify({ error: 'Invalid receipt_id' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (hasMovement && !isUuid(movement_id)) {
      return new Response(JSON.stringify({ error: 'Invalid movement_id' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { error } = await userClient.rpc('cancel_sale', {
      p_receipt_id: hasReceipt ? (receipt_id as string) : null,
      p_movement_id: hasMovement ? (movement_id as string) : null,
    })

    if (error) {
      console.error('cancel-sale RPC failed:', error)
      return genericInternalErrorResponse(req)
    }

    // Audit the cancellation as a semantic sale_cancelled event (actor + IP +
    // amount). The DB movements_audit_trigger already traces the row mutation;
    // this adds the business-level event the trigger cannot reconstruct. The
    // caller was authorized by the cancel_sale RPC, so the service-role read
    // below only fetches audit context (org_id, total_amount, currency).
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const receiptUuid = hasReceipt ? (receipt_id as string) : null
    const movementUuid = hasMovement ? (movement_id as string) : null

    const { data: receipt } = receiptUuid
      ? await adminClient
          .from('receipts')
          .select('id, org_id, total_amount, currency')
          .eq('id', receiptUuid)
          .maybeSingle()
      : { data: null }

    const { data: movement } =
      !receipt && movementUuid
        ? await adminClient
            .from('movements')
            .select('id, org_id, reference_id')
            .eq('id', movementUuid)
            .maybeSingle()
        : { data: null }

    const orgId = receipt?.org_id ?? movement?.org_id
    if (orgId) {
      await logActivity(adminClient, {
        org_id: orgId,
        actor_id: claims.sub,
        action: 'sale_cancelled',
        target_type: 'receipt',
        target_id: receiptUuid ?? movement?.reference_id ?? null,
        details: {
          receipt_id: receiptUuid,
          movement_id: movementUuid,
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
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
