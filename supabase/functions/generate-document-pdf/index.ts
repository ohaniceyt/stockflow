import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { buildDocumentPdfBase64, type DocumentType } from '../_shared/documentPdf.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody, isUuid, isEnum } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { getCurrentMembership } from '../_shared/membership.ts'

interface GenerateDocumentPdfPayload {
  document_id: string
  type: DocumentType
}

const DOCUMENT_TYPES = ['quote', 'invoice', 'delivery_note'] as const

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

    const parsed = await parseJsonBody<GenerateDocumentPdfPayload>(req)
    if (!parsed.ok) {
      return parsed.response
    }
    const { document_id, type } = parsed.body

    if (!isUuid(document_id) || !isEnum(type, DOCUMENT_TYPES)) {
      return new Response(JSON.stringify({ error: 'document_id and type are required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const membership = await getCurrentMembership(adminClient, claims.sub)
    if (!membership) {
      return new Response(JSON.stringify({ error: 'No active organization' }), {
        status: 403,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const { pdfBase64, filename, document } = await buildDocumentPdfBase64(
      adminClient,
      document_id,
      type,
      membership.org_id
    )

    return new Response(
      JSON.stringify({
        pdf_base64: pdfBase64,
        filename,
        document_id: document.id,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})
