-- Invoicing and receipts foundation for francophone African markets.
-- Design choices:
--   - Tax is optional per organization (settings-driven).
--   - Receipts are lightweight commercial proofs tied to cashier movements.
--   - Invoices are formal documents with items, optional tax, statuses and sequential numbering.
--   - Numbering sequences are isolated per org and document type to avoid collisions.

-- 1. Organization billing settings (optional, default disabled)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS has_invoicing_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_tax_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tax_name TEXT DEFAULT 'TVA',
ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_id TEXT,
ADD COLUMN IF NOT EXISTS invoice_prefix TEXT DEFAULT 'FA',
ADD COLUMN IF NOT EXISTS quote_prefix TEXT DEFAULT 'DEV',
ADD COLUMN IF NOT EXISTS delivery_note_prefix TEXT DEFAULT 'BL',
ADD COLUMN IF NOT EXISTS receipt_prefix TEXT DEFAULT 'REC',
ADD COLUMN IF NOT EXISTS legal_mentions TEXT;

-- 2. Receipts: lightweight proof of payment for cashier sales
CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  cashier_session_id UUID REFERENCES cashier_sessions(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  receipt_number TEXT NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'XOF',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS receipt_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  movement_id UUID REFERENCES movements(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Invoices / quotes / delivery notes
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'invoice' CHECK (type IN ('invoice', 'quote', 'delivery_note')),
  document_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partial', 'overdue', 'cancelled', 'converted')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  currency TEXT NOT NULL DEFAULT 'XOF',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  quote_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  movement_ids UUID[] DEFAULT '{}',
  note TEXT,
  terms TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Per-org document numbering
CREATE TABLE IF NOT EXISTS invoice_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('invoice', 'quote', 'delivery_note', 'receipt')),
  prefix TEXT NOT NULL,
  current_number BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, document_type)
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_receipts_org_id ON receipts(org_id);
CREATE INDEX IF NOT EXISTS idx_receipts_session_id ON receipts(cashier_session_id);
CREATE INDEX IF NOT EXISTS idx_receipts_issued_at ON receipts(issued_at);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt_id ON receipt_items(receipt_id);

CREATE INDEX IF NOT EXISTS idx_invoices_org_id ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_receipts_number_per_org ON receipts(org_id, receipt_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_per_org ON invoices(org_id, document_number);

-- 6. RLS enablement and policies
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_sequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_isolation_receipts ON receipts;
CREATE POLICY org_isolation_receipts ON receipts
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = receipts.org_id AND m.is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = receipts.org_id AND m.is_active = TRUE
  ));

DROP POLICY IF EXISTS org_isolation_receipt_items ON receipt_items;
CREATE POLICY org_isolation_receipt_items ON receipt_items
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM receipts r
    JOIN organization_memberships m ON m.org_id = r.org_id
    WHERE r.id = receipt_items.receipt_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM receipts r
    JOIN organization_memberships m ON m.org_id = r.org_id
    WHERE r.id = receipt_items.receipt_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ));

DROP POLICY IF EXISTS org_isolation_invoices ON invoices;
CREATE POLICY org_isolation_invoices ON invoices
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = invoices.org_id AND m.is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = invoices.org_id AND m.is_active = TRUE
  ));

DROP POLICY IF EXISTS org_isolation_invoice_items ON invoice_items;
CREATE POLICY org_isolation_invoice_items ON invoice_items
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM invoices i
    JOIN organization_memberships m ON m.org_id = i.org_id
    WHERE i.id = invoice_items.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM invoices i
    JOIN organization_memberships m ON m.org_id = i.org_id
    WHERE i.id = invoice_items.invoice_id AND m.user_id = auth.uid() AND m.is_active = TRUE
  ));

DROP POLICY IF EXISTS org_isolation_invoice_sequences ON invoice_sequences;
CREATE POLICY org_isolation_invoice_sequences ON invoice_sequences
  FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = invoice_sequences.org_id AND m.is_active = TRUE
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM organization_memberships m
    WHERE m.user_id = auth.uid() AND m.org_id = invoice_sequences.org_id AND m.is_active = TRUE
  ));

-- 7. Helper function: get next document number atomically
CREATE OR REPLACE FUNCTION next_document_number(
  p_org_id UUID,
  p_document_type TEXT,
  p_prefix TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_temp, public, pg_catalog
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO invoice_sequences (org_id, document_type, prefix, current_number)
  VALUES (p_org_id, p_document_type, p_prefix, 1)
  ON CONFLICT (org_id, document_type)
  DO UPDATE SET current_number = invoice_sequences.current_number + 1
  RETURNING current_number INTO v_next;

  RETURN p_prefix || '-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(v_next::TEXT, 6, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.next_document_number(UUID, TEXT, TEXT) TO authenticated;
