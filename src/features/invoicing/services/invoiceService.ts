/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { supabase } from '@/services/supabase'
import type {
  Invoice,
  InvoiceStatus,
  InvoiceWithItems,
  PaymentMethod,
  Quote,
  QuoteWithItems,
  DeliveryNote,
  DeliveryNoteWithItems,
  DocumentItem,
  Payment,
} from '@/types'
import type { Database } from '@/types/database'

type InvoiceRow = Database['public']['Tables']['invoices']['Row']
type InvoiceItemRow = Database['public']['Tables']['invoice_items']['Row']
type PaymentRow = Database['public']['Tables']['payments']['Row']

export interface DocumentLineInput {
  productId?: string | null
  description: string
  quantity: number
  unitPrice: number
  taxRate?: number
  discountAmount?: number
}

export interface CreateQuoteInput {
  orgId: string
  contactId?: string | null
  issueDate: string
  dueDate?: string | null
  currency: string
  note?: string | null
  terms?: string | null
  items: DocumentLineInput[]
}

export interface CreateInvoiceInput {
  orgId: string
  contactId?: string | null
  issueDate: string
  dueDate?: string | null
  currency: string
  note?: string | null
  terms?: string | null
  quoteId?: string | null
  items: DocumentLineInput[]
}

export interface CreateDeliveryNoteInput {
  orgId: string
  contactId?: string | null
  issueDate: string
  currency: string
  deliveryAddress?: string | null
  note?: string | null
  terms?: string | null
  items: DocumentLineInput[]
}

function computeItemTotal(item: DocumentLineInput): number {
  const qty = item.quantity ?? 1
  const unit = item.unitPrice ?? 0
  const discount = item.discountAmount ?? 0
  const taxable = Math.max(0, qty * unit - discount)
  const taxRate = item.taxRate ?? 0
  return Number((taxable * (1 + taxRate / 100)).toFixed(2))
}

function buildInvoiceItems(
  invoiceId: string,
  items: DocumentLineInput[]
): Omit<InvoiceItemRow, 'id' | 'created_at' | 'updated_at'>[] {
  return items.map((item) => ({
    invoice_id: invoiceId,
    product_id: item.productId ?? null,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    tax_rate: item.taxRate ?? 0,
    discount_amount: item.discountAmount ?? 0,
    total: computeItemTotal(item),
  }))
}

function computeTotals(items: DocumentLineInput[]) {
  const subtotal = items.reduce((sum, item) => {
    const qty = item.quantity ?? 1
    const unit = item.unitPrice ?? 0
    const discount = item.discountAmount ?? 0
    return sum + Math.max(0, qty * unit - discount)
  }, 0)

  const taxTotal = items.reduce((sum, item) => {
    const qty = item.quantity ?? 1
    const unit = item.unitPrice ?? 0
    const discount = item.discountAmount ?? 0
    const taxable = Math.max(0, qty * unit - discount)
    const taxRate = item.taxRate ?? 0
    return sum + taxable * (taxRate / 100)
  }, 0)

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxTotal: Number(taxTotal.toFixed(2)),
    total: Number((subtotal + taxTotal).toFixed(2)),
  }
}

export async function createQuote(input: CreateQuoteInput): Promise<QuoteWithItems> {
  const numberResponse = await supabase.rpc('next_document_number', {
    p_org_id: input.orgId,
    p_document_type: 'quote',
    p_prefix: '',
  })

  if (numberResponse.error) throw numberResponse.error
  const documentNumber = numberResponse.data
  if (!documentNumber) throw new Error('Failed to generate quote number')

  const { subtotal, taxTotal, total } = computeTotals(input.items)

  const { data: quote, error } = await supabase
    .from('invoices')
    .insert({
      org_id: input.orgId,
      contact_id: input.contactId ?? null,
      type: 'quote',
      document_number: documentNumber,
      status: 'draft',
      issue_date: input.issueDate,
      due_date: input.dueDate ?? null,
      currency: input.currency,
      subtotal,
      tax_total: taxTotal,
      total,
      paid_amount: 0,
      quote_id: null,
      movement_ids: null,
      note: input.note ?? null,
      terms: input.terms ?? null,
      delivery_address: null,
      delivered_at: null,
      converted_to_invoice_id: null,
      sent_at: null,
      converted_at: null,
    })
    .select()
    .single()

  if (error || !quote) {
    throw error ?? new Error('Failed to create quote')
  }

  const invoiceItems = buildInvoiceItems(quote.id, input.items)
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems)
    .select()

  if (itemsError) throw itemsError

  return {
    ...mapQuote(quote),
    items: (items ?? []).map(mapDocumentItem),
  }
}

export async function createInvoice(input: CreateInvoiceInput): Promise<InvoiceWithItems> {
  const numberResponse = await supabase.rpc('next_document_number', {
    p_org_id: input.orgId,
    p_document_type: 'invoice',
    p_prefix: '',
  })

  if (numberResponse.error) throw numberResponse.error
  const documentNumber = numberResponse.data
  if (!documentNumber) throw new Error('Failed to generate invoice number')

  const { subtotal, taxTotal, total } = computeTotals(input.items)

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      org_id: input.orgId,
      contact_id: input.contactId ?? null,
      type: 'invoice',
      document_number: documentNumber,
      status: 'draft',
      issue_date: input.issueDate,
      due_date: input.dueDate ?? null,
      currency: input.currency,
      subtotal,
      tax_total: taxTotal,
      total,
      paid_amount: 0,
      quote_id: input.quoteId ?? null,
      movement_ids: null,
      note: input.note ?? null,
      terms: input.terms ?? null,
      delivery_address: null,
      delivered_at: null,
      converted_to_invoice_id: null,
      sent_at: null,
      converted_at: null,
    })
    .select()
    .single()

  if (error || !invoice) {
    throw error ?? new Error('Failed to create invoice')
  }

  const invoiceItems = buildInvoiceItems(invoice.id, input.items)
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems)
    .select()

  if (itemsError) throw itemsError

  return {
    ...mapInvoice(invoice),
    items: (items ?? []).map(mapDocumentItem),
    payments: [],
  }
}

export async function createDeliveryNote(
  input: CreateDeliveryNoteInput
): Promise<DeliveryNoteWithItems> {
  const numberResponse = await supabase.rpc('next_document_number', {
    p_org_id: input.orgId,
    p_document_type: 'delivery_note',
    p_prefix: '',
  })

  if (numberResponse.error) throw numberResponse.error
  const documentNumber = numberResponse.data
  if (!documentNumber) throw new Error('Failed to generate delivery note number')

  const { subtotal, taxTotal, total } = computeTotals(input.items)

  const { data: dn, error } = await supabase
    .from('invoices')
    .insert({
      org_id: input.orgId,
      contact_id: input.contactId ?? null,
      type: 'delivery_note',
      document_number: documentNumber,
      status: 'draft',
      issue_date: input.issueDate,
      due_date: null,
      currency: input.currency,
      subtotal,
      tax_total: taxTotal,
      total,
      paid_amount: 0,
      quote_id: null,
      movement_ids: null,
      note: input.note ?? null,
      terms: input.terms ?? null,
      delivery_address: input.deliveryAddress ?? null,
      delivered_at: null,
      converted_to_invoice_id: null,
      sent_at: null,
      converted_at: null,
    })
    .select()
    .single()

  if (error || !dn) {
    throw error ?? new Error('Failed to create delivery note')
  }

  const invoiceItems = buildInvoiceItems(dn.id, input.items)
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .insert(invoiceItems)
    .select()

  if (itemsError) throw itemsError

  return {
    ...mapDeliveryNote(dn),
    items: (items ?? []).map(mapDocumentItem),
  }
}

export async function getQuotes(orgId: string): Promise<QuoteWithItems[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('org_id', orgId)
    .eq('type', 'quote')
    .order('created_at', { ascending: false })

  if (error) throw error
  return hydrateDocuments(data ?? [], 'quote') as unknown as QuoteWithItems[]
}

export async function getInvoices(orgId: string): Promise<InvoiceWithItems[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('org_id', orgId)
    .eq('type', 'invoice')
    .order('created_at', { ascending: false })

  if (error) throw error
  return hydrateDocuments(data ?? [], 'invoice') as unknown as InvoiceWithItems[]
}

export async function getDeliveryNotes(orgId: string): Promise<DeliveryNoteWithItems[]> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('org_id', orgId)
    .eq('type', 'delivery_note')
    .order('created_at', { ascending: false })

  if (error) throw error
  return hydrateDocuments(data ?? [], 'delivery_note') as unknown as DeliveryNoteWithItems[]
}

export async function getInvoiceWithItems(invoiceId: string): Promise<InvoiceWithItems> {
  return getDocument(invoiceId, 'invoice') as Promise<InvoiceWithItems>
}

export async function getQuoteWithItems(quoteId: string): Promise<QuoteWithItems> {
  return getDocument(quoteId, 'quote') as Promise<QuoteWithItems>
}

export async function getDeliveryNoteWithItems(
  deliveryNoteId: string
): Promise<DeliveryNoteWithItems> {
  return getDocument(deliveryNoteId, 'delivery_note') as Promise<DeliveryNoteWithItems>
}

async function getDocument(
  id: string,
  type: 'invoice' | 'quote' | 'delivery_note'
): Promise<InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems> {
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .eq('type', type)
    .single()

  if (error || !data) {
    throw error ?? new Error(`${type} not found`)
  }

  return hydrateSingleDocument(data, type)
}

async function hydrateDocuments(
  rows: InvoiceRow[],
  type: 'invoice' | 'quote' | 'delivery_note'
): Promise<(InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems)[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .in('invoice_id', ids)

  if (itemsError) throw itemsError

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .in('invoice_id', ids)

  if (paymentsError) throw paymentsError

  const itemsByDoc = groupBy(items ?? [], (i) => i.invoice_id)
  const paymentsByInvoice = groupBy(payments ?? [], (p) => p.invoice_id)

  return rows.map((row) =>
    hydrateRow(row, type, itemsByDoc.get(row.id) ?? [], paymentsByInvoice.get(row.id) ?? [])
  )
}

async function hydrateSingleDocument(
  row: InvoiceRow,
  type: 'invoice' | 'quote' | 'delivery_note'
): Promise<InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems> {
  const { data: items, error: itemsError } = await supabase
    .from('invoice_items')
    .select('*')
    .eq('invoice_id', row.id)

  if (itemsError) throw itemsError

  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice_id', row.id)

  if (paymentsError) throw paymentsError

  return hydrateRow(row, type, items ?? [], payments ?? [])
}

function hydrateRow(
  row: InvoiceRow,
  type: 'invoice' | 'quote' | 'delivery_note',
  items: InvoiceItemRow[],
  payments: PaymentRow[]
): InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems {
  const mappedItems = items.map(mapDocumentItem)
  if (type === 'quote') {
    return { ...mapQuote(row), items: mappedItems }
  }
  if (type === 'delivery_note') {
    return { ...mapDeliveryNote(row), items: mappedItems }
  }
  return { ...mapInvoice(row), items: mappedItems, payments: payments.map(mapPayment) }
}

export async function updateDocumentStatus(
  id: string,
  status: InvoiceRow['status'],
  sentAt?: string | null
): Promise<void> {
  const update: { status: InvoiceRow['status']; sent_at?: string | null } = { status }
  if (sentAt !== undefined) {
    update.sent_at = sentAt
  }
  const { error } = await supabase
    .from('invoices')
    .update(update as unknown as Database['public']['Tables']['invoices']['Update'])
    .eq('id', id)
  if (error) throw error
}

export async function convertQuoteToInvoice(quoteId: string): Promise<string> {
  const { data, error } = await supabase.rpc('convert_quote_to_invoice', {
    p_quote_id: quoteId,
    p_issue_date: undefined,
    p_due_date: undefined,
  })

  if (error) throw error
  if (!data) throw new Error('Failed to convert quote')
  return data
}

export async function recordPayment(
  invoiceId: string,
  amount: number,
  paymentMethod: PaymentRow['payment_method'],
  reference?: string | null
): Promise<void> {
  const { error } = await supabase.rpc('record_invoice_payment', {
    p_invoice_id: invoiceId,
    p_amount: amount,
    p_payment_method: paymentMethod,
    p_reference: reference ?? undefined,
    p_paid_at: undefined,
  })

  if (error) throw error
}

export async function markDeliveryNoteDelivered(deliveryNoteId: string): Promise<void> {
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent', delivered_at: new Date().toISOString() })
    .eq('id', deliveryNoteId)
    .eq('type', 'delivery_note')

  if (error) throw error
}

function mapInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    orgId: row.org_id,
    contactId: row.contact_id,
    type: 'invoice',
    documentNumber: row.document_number,
    status: row.status as InvoiceStatus,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    subtotal: row.subtotal,
    taxTotal: row.tax_total,
    total: row.total,
    paidAmount: row.paid_amount,
    quoteId: row.quote_id,
    movementIds: row.movement_ids,
    note: row.note,
    terms: row.terms,
    sentAt: row.sent_at,
    deliveryAddress: row.delivery_address,
    deliveredAt: row.delivered_at,
    convertedToInvoiceId: row.converted_to_invoice_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapQuote(row: InvoiceRow): Quote {
  return {
    id: row.id,
    orgId: row.org_id,
    contactId: row.contact_id,
    type: 'quote',
    documentNumber: row.document_number,
    status: row.status as Quote['status'],
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    subtotal: row.subtotal,
    taxTotal: row.tax_total,
    total: row.total,
    convertedToInvoiceId: row.converted_to_invoice_id,
    movementIds: row.movement_ids,
    note: row.note,
    terms: row.terms,
    convertedAt: row.converted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDeliveryNote(row: InvoiceRow): DeliveryNote {
  return {
    id: row.id,
    orgId: row.org_id,
    contactId: row.contact_id,
    type: 'delivery_note',
    documentNumber: row.document_number,
    status: row.status as DeliveryNote['status'],
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    subtotal: row.subtotal,
    taxTotal: row.tax_total,
    total: row.total,
    deliveryAddress: row.delivery_address,
    deliveredAt: row.delivered_at,
    sentAt: row.sent_at,
    movementIds: row.movement_ids,
    note: row.note,
    terms: row.terms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDocumentItem(row: InvoiceItemRow): DocumentItem {
  return {
    id: row.id,
    documentId: row.invoice_id,
    productId: row.product_id,
    description: row.description,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    taxRate: row.tax_rate,
    discountAmount: row.discount_amount,
    total: row.total,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orgId: row.org_id,
    invoiceId: row.invoice_id,
    amount: row.amount,
    paymentMethod: row.payment_method as PaymentMethod,
    reference: row.reference,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  return map
}
