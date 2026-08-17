import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { buildDocumentPdfBase64 } from '../_shared/documentPdf.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'
import { parseJsonBody } from '../_shared/validate.ts'
import { isEmail, isUuid } from '../_shared/validate.ts'
import { escapeHtml } from '../_shared/html.ts'
import { genericInternalErrorResponse } from '../_shared/errors.ts'
import { getCurrentMembership } from '../_shared/membership.ts'

interface SendInvoiceReminderPayload {
  invoice_id: string
  to?: string
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

    const parsed = await parseJsonBody<SendInvoiceReminderPayload>(req)
    if (!parsed.ok) return parsed.response

    if (!isUuid(parsed.body.invoice_id)) {
      return new Response(JSON.stringify({ error: 'invoice_id must be a valid UUID' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
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

    const { data: invoice, error: invoiceError } = await adminClient
      .from('invoices')
      .select('*, org:organizations(*), contact:contacts(*)')
      .eq('id', parsed.body.invoice_id)
      .eq('org_id', membership.org_id)
      .eq('type', 'invoice')
      .single()

    if (invoiceError || !invoice) {
      return new Response(JSON.stringify({ error: 'Invoice not found' }), {
        status: 404,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const status = String(invoice.status)
    if (status === 'paid' || status === 'cancelled') {
      return new Response(
        JSON.stringify({ success: false, reason: `Invoice is already ${status}` }),
        { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
      )
    }

    const { pdfBase64, filename } = await buildDocumentPdfBase64(
      adminClient,
      parsed.body.invoice_id,
      'invoice',
      membership.org_id
    )

    const recipient = parsed.body.to ?? (invoice.contact as Record<string, unknown>)?.email ?? null
    if (!recipient) {
      return new Response(JSON.stringify({ error: 'No recipient email provided or found' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const orgNameRaw = (invoice.org as Record<string, unknown>)?.name ?? 'StockFlow'
    const documentNumberRaw = invoice.document_number as string
    const totalFormattedRaw = formatCurrency(Number(invoice.total), invoice.currency as string)
    const paidAmount = Number(invoice.paid_amount ?? 0)
    const remaining = Math.max(0, Number(invoice.total) - paidAmount)

    const orgName = escapeHtml(orgNameRaw)
    const documentNumber = escapeHtml(documentNumberRaw)
    const totalFormatted = escapeHtml(totalFormattedRaw)
    const remainingFormatted = escapeHtml(formatCurrency(remaining, invoice.currency as string))

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rappel - Votre facture ${documentNumber}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <p>Bonjour,</p>
    <p>Nous vous rappelons que votre facture <strong>${documentNumber}</strong> de <strong>${orgName}</strong> d'un montant de <strong>${totalFormatted}</strong> n'a pas encore été réglée.</p>
    ${remaining > 0 ? `<p>Reste à payer : <strong>${remainingFormatted}</strong></p>` : ''}
    <p>La facture est jointe à cet email. Merci de procéder au règlement dans les meilleurs délais.</p>
    <br />
    <p><em>Cet email a été envoyé automatiquement par StockFlow.</em></p>
  </body>
</html>`

    const text = `Bonjour,

Nous vous rappelons que votre facture ${documentNumber} de ${orgName} d'un montant de ${totalFormatted} n'a pas encore été réglée.
${
  remaining > 0
    ? `Reste à payer : ${formatCurrency(remaining, invoice.currency as string)}
`
    : ''
}La facture est jointe à cet email. Merci de procéder au règlement dans les meilleurs délais.

Cet email a été envoyé automatiquement par StockFlow.`

    const emailResult = await sendEmail({
      to: recipient,
      subject: `Rappel : Votre facture ${documentNumber} - ${orgName}`,
      html,
      text,
      attachments: [{ filename, content: pdfBase64 }],
    })

    // Track reminder on the invoice row.
    const { data: current } = await adminClient
      .from('invoices')
      .select('reminders_sent')
      .eq('id', parsed.body.invoice_id)
      .single()
    await adminClient
      .from('invoices')
      .update({
        reminders_sent: (current?.reminders_sent ?? 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parsed.body.invoice_id)

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        invoice_id: invoice.id,
        sent_to: recipient,
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } }
    )
  } catch (_err) {
    return genericInternalErrorResponse(req)
  }
})

function formatCurrency(amount: number, currency: string) {
  const formatted = amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  return `${formatted.replace(/[  ]/g, ' ')} ${currency}`
}
