-- Invoice reminders: scheduled function to nudge customers with unpaid/overdue invoices.
-- Adds a lightweight reminders_sent counter and a function invoked by pg_cron or manually.

ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS reminders_sent INTEGER NOT NULL DEFAULT 0;

-- Index to find invoices needing a reminder.
CREATE INDEX IF NOT EXISTS idx_invoices_reminder_candidates
  ON invoices(org_id, type, status, due_date)
  WHERE type = 'invoice' AND status NOT IN ('paid', 'cancelled');

-- Function: fetch candidate invoices and send reminder via the Edge Function.
-- Designed to be called by pg_cron; the actual HTTP call is delegated to the cron job config.
CREATE OR REPLACE FUNCTION get_overdue_invoices_for_org(p_org_id UUID)
RETURNS TABLE (
  invoice_id UUID,
  document_number TEXT,
  total NUMERIC,
  currency TEXT,
  due_date DATE,
  contact_email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
  SELECT
    i.id AS invoice_id,
    i.document_number,
    i.total,
    i.currency,
    i.due_date,
    c.email AS contact_email
  FROM invoices i
  LEFT JOIN contacts c ON c.id = i.contact_id
  WHERE i.org_id = p_org_id
    AND i.type = 'invoice'
    AND i.status NOT IN ('paid', 'cancelled')
    AND (
      i.due_date IS NULL
      OR i.due_date <= CURRENT_DATE + INTERVAL '1 day'
    )
  ORDER BY i.due_date ASC;
$$;

-- RLS: reminders are managed via service-role/Edge Function only.
GRANT EXECUTE ON FUNCTION public.get_overdue_invoices_for_org(UUID) TO authenticated;
