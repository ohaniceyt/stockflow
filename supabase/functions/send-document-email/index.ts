import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { buildDocumentPdfBase64, type DocumentType } from '../_shared/documentPdf.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { escapeHtml } from '../_shared/html.ts'
import { parseJsonBody, isUuid, isEnum, isEmail } from '../_shared/validate.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { getCurrentMembership } from '../_shared/membership.ts'

interface SendDocumentEmailPayload {
  document_id: string
  type: DocumentType
  to?: string
}

const DOCUMENT_TYPES: readonly DocumentType[] = ['quote', 'invoice', 'delivery_note']

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

    const parsed = await parseJsonBody<SendDocumentEmailPayload>(req)
    if (!parsed.ok) return parsed.response

    if (!isUuid(parsed.body.document_id)) {
      return new Response(JSON.stringify({ error: 'document_id must be a valid UUID' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    if (!isEnum(parsed.body.type, DOCUMENT_TYPES)) {
      return new Response(
        JSON.stringify({ error: 'type must be quote, invoice, or delivery_note' }),
        {
          status: 400,
          headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        }
      )
    }

    if (parsed.body.to !== undefined && !isEmail(parsed.body.to)) {
      return new Response(JSON.stringify({ error: 'Invalid recipient email' }), {
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
      parsed.body.document_id,
      parsed.body.type,
      membership.org_id
    )

    let recipient = parsed.body.to
    if (!recipient && document.contact_id) {
      const { data: contact } = await adminClient
        .from('contacts')
        .select('email')
        .eq('id', document.contact_id)
        .single()
      recipient = contact?.email
    }

    if (!recipient) {
      return new Response(JSON.stringify({ error: 'No recipient email provided or found' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const orgName = (document.org as Record<string, unknown>)?.name ?? 'StockFlow'
    const documentNumber = document.document_number as string
    const typeLabel = documentTitle(parsed.body.type)
    const totalFormatted = formatCurrency(Number(document.total), document.currency as string)

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Votre ${typeLabel} ${escapeHtml(documentNumber)}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint votre ${typeLabel.toLowerCase()} <strong>${escapeHtml(documentNumber)}</strong> de <strong>${escapeHtml(orgName)}</strong>.</p>
    <p>Total : <strong>${escapeHtml(totalFormatted)}</strong></p>
    <p>Merci pour votre confiance.</p>
    <br />
    <p><em>Cet email a été envoyé automatiquement par StockFlow.</em></p>
  </body>
</html>`

    const text = `Bonjour,\n\nVeuillez trouver ci-joint votre ${typeLabel.toLowerCase()} ${escapeHtml(documentNumber)} de ${escapeHtml(orgName)}.\nTotal : ${escapeHtml(totalFormatted)}\n\nMerci pour votre confiance.\n\nCet email a été envoyé automatiquement par StockFlow.`

    const emailResult = await sendEmail({
      to: recipient,
      subject: `Votre ${typeLabel} ${escapeHtml(documentNumber)} - ${escapeHtml(orgName)}`,
      html,
      text,
      attachments: [{ filename, content: pdfBase64 }],
    })

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        document_id: document.id,
        sent_to: recipient,
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

function documentTitle(type: DocumentType): string {
  switch (type) {
    case 'quote':
      return 'Devis'
    case 'invoice':
      return 'Facture'
    case 'delivery_note':
      return 'Bon de livraison'
  }
}

function formatCurrency(amount: number, currency: string) {
  const formatted = amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `${formatted.replace(/[  ]/g, ' ')} ${currency}`
}
