import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { getBearerToken, verifyToken } from '../_shared/auth.ts'
import { sendEmail } from '../_shared/resend.ts'
import { buildDocumentPdfBase64, type DocumentType } from '../_shared/documentPdf.ts'

interface SendDocumentEmailPayload {
  document_id: string
  type: DocumentType
  to?: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const claims = await verifyToken(supabaseUrl, anonKey, token)
    if (!claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const payload: SendDocumentEmailPayload = await req.json()
    if (!payload.document_id || !payload.type) {
      return new Response(JSON.stringify({ error: 'document_id and type are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { pdfBase64, filename, document } = await buildDocumentPdfBase64(
      adminClient,
      payload.document_id,
      payload.type,
    )

    let recipient = payload.to
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const orgName = (document.org as Record<string, unknown>)?.name ?? 'StockFlow'
    const documentNumber = document.document_number as string
    const typeLabel = documentTitle(payload.type)
    const totalFormatted = formatCurrency(Number(document.total), document.currency as string)

    const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Votre ${typeLabel} ${documentNumber}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <p>Bonjour,</p>
    <p>Veuillez trouver ci-joint votre ${typeLabel.toLowerCase()} <strong>${documentNumber}</strong> de <strong>${orgName}</strong>.</p>
    <p>Total : <strong>${totalFormatted}</strong></p>
    <p>Merci pour votre confiance.</p>
    <br />
    <p><em>Cet email a été envoyé automatiquement par StockFlow.</em></p>
  </body>
</html>`

    const text = `Bonjour,\n\nVeuillez trouver ci-joint votre ${typeLabel.toLowerCase()} ${documentNumber} de ${orgName}.\nTotal : ${totalFormatted}\n\nMerci pour votre confiance.\n\nCet email a été envoyé automatiquement par StockFlow.`

    const emailResult = await sendEmail({
      to: recipient,
      subject: `Votre ${typeLabel} ${documentNumber} - ${orgName}`,
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${formatted.replace(/[  ]/g, ' ')} ${currency}`
}
