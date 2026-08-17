import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { getCurrentMembership } from '../_shared/membership.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { isString, isUuid, normalizeString, parseJsonBody } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { logActivity } from '../_shared/audit.ts'

// Édition des métadonnées d'un mouvement (admin-only).
//
// Portée stricte : seuls `reason` et `contact_id` sont éditables. On ne touche
// jamais au stock (type/quantity/stock_before/stock_after/product/location) ni
// à `reference_id` (lien UUID vers le reçu de caisse, géré par complete_sale /
// cancel-sale — l'éditer casserait la réconciliation caisse). L'UPDATE passe
// par la service role car aucune policy RLS UPDATE n'existe sur `movements`
// (append-only côté client). La table n'a pas de colonne updated_at : on ne
// la set pas.
//
// Sémantique PATCH : seules les clés présentes dans le body sont appliquées.
// Audit : une ligne activity_logs `movement_metadata_edited` avec le vrai
// acteur + le diff before/after (le trigger auto movements_audit_trigger
// sature aussi mais avec actor NULL et details limités à type/qty/is_cancelled
// — non significatif pour reason/contact).

interface UpdateMovementPayload {
  org_id: string
  movement_id: string
  reason?: unknown
  contact_id?: unknown
}

function jsonError(req: Request, message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  })
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
      return genericInternalErrorResponse(req)
    }

    const token = getBearerToken(req)
    if (!token) {
      return jsonError(req, 'Unauthorized', 401)
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return jsonError(req, 'Unauthorized', 401)
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const parsed = await parseJsonBody<UpdateMovementPayload>(req)
    if (!parsed.ok) {
      return parsed.response
    }
    const body = parsed.body

    if (!isUuid(body.org_id) || !isUuid(body.movement_id)) {
      return jsonError(req, 'Invalid request', 400)
    }

    // Détermine les clés présentes (PATCH partiel).
    const hasReason = Object.prototype.hasOwnProperty.call(body, 'reason')
    const hasContactId = Object.prototype.hasOwnProperty.call(body, 'contact_id')
    if (!hasReason && !hasContactId) {
      return jsonError(req, 'Rien à mettre à jour', 400)
    }

    // reason : trim -> null, puis isString(<=500) si non-null.
    let reason: string | null | undefined
    if (hasReason) {
      reason = normalizeString(body.reason)
      if (reason !== null && !isString(reason, 500)) {
        return jsonError(req, 'La raison est invalide', 400)
      }
    }

    // contact_id : UUID valide si fourni non-null.
    let contactId: string | null | undefined
    if (hasContactId) {
      const normalized = normalizeString(body.contact_id)
      if (normalized !== null && !isUuid(normalized)) {
        return jsonError(req, 'Contact invalide', 400)
      }
      contactId = normalized
    }

    // Résout la membership de cette org ; admin-only.
    const membership = await getCurrentMembership(adminClient, claims.sub, body.org_id)
    if (!membership || !['super_admin', 'admin'].includes(membership.role)) {
      return jsonError(req, 'Forbidden', 403)
    }
    const orgId = membership.org_id

    // Charge l'état before, scoped à l'org de l'admin (garantit l'appartenance).
    const { data: before, error: beforeError } = await adminClient
      .from('movements')
      .select('id, org_id, reason, contact_id, type')
      .eq('id', body.movement_id)
      .eq('org_id', orgId)
      .maybeSingle()

    if (beforeError || !before) {
      return jsonError(req, 'Mouvement introuvable', 404)
    }

    // Valide le contact (appartient à l'org + actif) si fourni non-null.
    if (contactId) {
      const { data: contact } = await adminClient
        .from('contacts')
        .select('id')
        .eq('id', contactId)
        .eq('org_id', orgId)
        .eq('is_active', true)
        .maybeSingle()
      if (!contact) {
        return jsonError(req, 'Contact introuvable dans cette entreprise', 400)
      }
    }

    // Construit le payload UPDATE (clés présentes seulement, pas d'updated_at).
    const update: Record<string, string | null> = {}
    if (hasReason) update.reason = reason ?? null
    if (hasContactId) update.contact_id = contactId ?? null

    const { error: updateError } = await adminClient
      .from('movements')
      .update(update)
      .eq('id', body.movement_id)
      .eq('org_id', orgId)

    if (updateError) {
      console.error('[update-movement] update failed', updateError)
      return genericInternalErrorResponse(req)
    }

    const after: Record<string, string | null> = {}
    if (hasReason) after.reason = reason ?? null
    if (hasContactId) after.contact_id = contactId ?? null

    await logActivity(adminClient, {
      org_id: orgId,
      actor_id: claims.sub,
      action: 'movement_metadata_edited',
      target_type: 'movement',
      target_id: body.movement_id,
      details: {
        before: {
          reason: before.reason ?? null,
          contact_id: before.contact_id ?? null,
        },
        after,
      },
      ip_address: req.headers.get('x-forwarded-for') ?? null,
    })

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[update-movement] uncaught error', message)
    return genericInternalErrorResponse(req)
  }
})
