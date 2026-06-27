import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { buildReceiptPdfBase64 } from '../_shared/receiptPdf.ts'
import { getCorsHeaders, corsResponse } from '../_shared/cors.ts'

interface SendReceiptEmailPayload {
  receipt_id: string
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

    const payload: SendReceiptEmailPayload = await req.json()
    if (!payload.receipt_id) {
      return new Response(JSON.stringify({ error: 'receipt_id is required' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { pdfBase64, filename, receipt } = await buildReceiptPdfBase64(
      adminClient,
      payload.receipt_id
    )

    let recipient = payload.to
    if (!recipient && receipt.contact_id) {
      const { data: contact } = await adminClient
        .from('contacts')
        .select('email')
        .eq('id', receipt.contact_id)
        .single()
      recipient = contact?.email
    }

    if (!recipient) {
      return new Response(JSON.stringify({ error: 'No recipient email provided or found' }), {
        status: 400,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      })
    }

    const orgName = (receipt.org as Record<string, unknown>)?.name ?? 'StockFlow'
    const documentNumber = receipt.document_number as string

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Votre reçu ${documentNumber}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;" >
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint votre reçu <strong>${documentNumber}</strong> de <strong>${orgName}</strong>.</p>
    <p>Total : <strong>${formatCurrency(Number(receipt.total), receipt.currency as string)}</strong></p>
    <p>Merci pour votre confiance.</p>
    <br />
    <p><em>Cet email a été envoyé automatiquement par StockFlow.</em></p>
  </body>
</html>`

    const text = `Bonjour,\n\nVeuillez trouver ci-joint votre reçu ${documentNumber} de ${orgName}.\nTotal : ${formatCurrency(
      Number(receipt.total),
      receipt.currency as string
    )}\n\nMerci pour votre confiance.\n\nCet email a été envoyé automatiquement par StockFlow.`

    const emailResult = await sendEmail({
      to: recipient,
      subject: `Votre reçu ${documentNumber} - ${orgName}`,
      html,
      text,
      attachments: [
        {
          filename,
          content: pdfBase64,
        },
      ],
    })

    return new Response(
      JSON.stringify({
        success: true,
        email_id: emailResult.id,
        receipt_id: receipt.id,
        sent_to: recipient,
      }),
      {
        status: 200,
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})

function formatCurrency(amount: number, currency: string) {
  return `${amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`
}
