import { createClient } from 'npm:@supabase/supabase-js@2.49.4'
import { buildDocumentPdfBase64 } from '../_shared/documentPdf.ts'
import { sendEmail } from '../_shared/resend.ts'

interface OrgReminderSettings {
  id: string
  auto_reminder_enabled: boolean
  auto_reminder_days: number
}

interface OverdueInvoice {
  invoice_id: string
  document_number: string
  total: number
  currency: string
  due_date: string | null
  contact_email: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('authorization')
  const expectedSecret = Deno.env.get('AUTO_REMINDER_SECRET')
  if (expectedSecret && authHeader !== `Bearer ${expectedSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
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

    const { data: orgs, error: orgsError } = await adminClient
      .from('organizations')
      .select('id, auto_reminder_enabled, auto_reminder_days')
      .eq('auto_reminder_enabled', true)
      .eq('is_active', true)
      .eq('is_suspended', false)

    if (orgsError) throw orgsError

    const results: Array<{ orgId: string; invoiceId: string; status: 'sent' | 'skipped' | 'error'; detail?: string }> = []

    for (const org of (orgs ?? []) as OrgReminderSettings[]) {
      const daysBefore = Math.max(0, org.auto_reminder_days ?? 3)
      const { data: invoices, error: invoicesError } = await adminClient.rpc('get_overdue_invoices_for_org', {
        p_org_id: org.id,
      })

      if (invoicesError) {
        results.push({ orgId: org.id, invoiceId: '', status: 'error', detail: invoicesError.message })
        continue
      }

      for (const inv of (invoices ?? []) as OverdueInvoice[]) {
        if (!inv.contact_email) {
          results.push({ orgId: org.id, invoiceId: inv.invoice_id, status: 'skipped', detail: 'no contact email' })
          continue
        }

        const shouldRemind =
          !inv.due_date ||
          new Date(inv.due_date).getTime() <= Date.now() + daysBefore * 24 * 60 * 60 * 1000

        if (!shouldRemind) {
          results.push({ orgId: org.id, invoiceId: inv.invoice_id, status: 'skipped', detail: 'too early' })
          continue
        }

        try {
          const { pdfBase64, filename, document } = await buildDocumentPdfBase64(adminClient, inv.invoice_id, 'invoice')
          const orgName = (document.org as Record<string, unknown>)?.name ?? 'StockFlow'
          const paidAmount = Number((document as Record<string, unknown>).paid_amount ?? 0)
          const remaining = Math.max(0, inv.total - paidAmount)

          const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Rappel - Votre facture ${inv.document_number}</title>
  </head>
  <body style="font-family: Arial, sans-serif; color: #333;">
    <p>Bonjour,</p>
    <p>Nous vous rappelons que votre facture <strong>${inv.document_number}</strong> de <strong>${orgName}</strong> d'un montant de <strong>${formatCurrency(inv.total, inv.currency)}</strong> n'a pas encore été réglée.</p>
    ${remaining > 0 ? `<p>Reste à payer : <strong>${formatCurrency(remaining, inv.currency)}</strong></p>` : ''}
    <p>La facture est jointe à cet email. Merci de procéder au règlement dans les meilleurs délais.</p>
    <br />
    <p><em>Cet email a été envoyé automatiquement par StockFlow.</em></p>
  </body>
</html>`

          const text = `Bonjour,\n\nNous vous rappelons que votre facture ${inv.document_number} de ${orgName} d'un montant de ${formatCurrency(inv.total, inv.currency)} n'a pas encore été réglée.\n${remaining > 0 ? `Reste à payer : ${formatCurrency(remaining, inv.currency)}\n` : ''}La facture est jointe à cet email. Merci de procéder au règlement dans les meilleurs délais.\n\nCet email a été envoyé automatiquement par StockFlow.`

          await sendEmail({
            to: inv.contact_email,
            subject: `Rappel : Votre facture ${inv.document_number} - ${orgName}`,
            html,
            text,
            attachments: [{ filename, content: pdfBase64 }],
          })

          const { data: current } = await adminClient
            .from('invoices')
            .select('reminders_sent')
            .eq('id', inv.invoice_id)
            .single()
          await adminClient
            .from('invoices')
            .update({ reminders_sent: (current?.reminders_sent ?? 0) + 1, updated_at: new Date().toISOString() })
            .eq('id', inv.invoice_id)

          results.push({ orgId: org.id, invoiceId: inv.invoice_id, status: 'sent' })
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          results.push({ orgId: org.id, invoiceId: inv.invoice_id, status: 'error', detail: message })
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    const details =
      err instanceof Error
        ? { message: err.message, name: err.name, stack: err.stack }
        : { raw: typeof err === 'object' ? JSON.stringify(err) : String(err) }
    console.error('send-auto-reminders error:', details)
    return new Response(JSON.stringify({ error: 'Internal error', details }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

function formatCurrency(amount: number, currency: string) {
  const formatted = amount.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  return `${formatted.replace(/[  ]/g, ' ')} ${currency}`
}
