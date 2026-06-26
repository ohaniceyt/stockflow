import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

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

    const baseUrl = Deno.env.get('FUNCTIONS_BASE_URL') ?? `${supabaseUrl}/functions/v1`
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceSecret = Deno.env.get('SERVICE_ROLE_SECRET')
    if (!serviceSecret && !anonKey) {
      throw new Error('Missing service or anon key for internal calls')
    }

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
          const res = await fetch(`${baseUrl}/send-invoice-reminder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${serviceSecret ?? anonKey}`,
            },
            body: JSON.stringify({
              invoice_id: inv.invoice_id,
              to: inv.contact_email,
            }),
          })

          if (!res.ok) {
            const text = await res.text().catch(() => '')
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
          }

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
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
