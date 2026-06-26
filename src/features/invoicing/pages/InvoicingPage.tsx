import { useState } from 'react'
import { Plus, FileText, TrendingUp, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/context/AuthContext'
import {
  useQuotes,
  useInvoices,
  useDeliveryNotes,
  useCreateQuote,
  useCreateInvoice,
  useCreateDeliveryNote,
} from '@/features/invoicing/hooks/useInvoices'
import DocumentActions from '@/features/invoicing/components/DocumentActions'
import type { InvoiceWithItems, QuoteWithItems, DeliveryNoteWithItems } from '@/types'

type DocumentWithItems = InvoiceWithItems | QuoteWithItems | DeliveryNoteWithItems
type TabType = 'quotes' | 'invoices' | 'delivery-notes' | 'overview'

interface DashboardMetrics {
  totalInvoiced: number
  totalPaid: number
  totalOverdue: number
  openQuotes: number
  sentInvoices: number
  deliveredNotes: number
}

function computeMetrics(
  quotes: QuoteWithItems[],
  invoices: InvoiceWithItems[],
  deliveryNotes: DeliveryNoteWithItems[]
): DashboardMetrics {
  const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.total, 0)
  const totalPaid = invoices.reduce((sum, inv) => sum + inv.paidAmount, 0)
  const now = new Date().toISOString().slice(0, 10)
  const totalOverdue = invoices
    .filter(
      (inv) =>
        inv.status !== 'paid' && inv.status !== 'cancelled' && inv.dueDate && inv.dueDate < now
    )
    .reduce((sum, inv) => sum + Math.max(0, inv.total - inv.paidAmount), 0)
  return {
    totalInvoiced,
    totalPaid,
    totalOverdue,
    openQuotes: quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length,
    sentInvoices: invoices.filter(
      (i) => i.status === 'sent' || i.status === 'partial' || i.status === 'overdue'
    ).length,
    deliveredNotes: deliveryNotes.filter((d) => d.status === 'delivered').length,
  }
}

function MetricCard({
  label,
  value,
  icon: Icon,
  variant = 'default',
}: {
  label: string
  value: string
  icon: React.ElementType
  variant?: 'default' | 'success' | 'warning' | 'danger'
}) {
  const colorClass =
    variant === 'success'
      ? 'text-green-600'
      : variant === 'warning'
        ? 'text-amber-600'
        : variant === 'danger'
          ? 'text-destructive'
          : 'text-primary'
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className={`h-4 w-4 ${colorClass}`} />
      </div>
      <p className={`mt-1 text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  )
}

function formatCurrency(value: number, currency: string): string {
  return `${value.toLocaleString('fr-FR')} ${currency}`
}

function DocumentList({
  items,
  type,
  onSelect,
}: {
  items: DocumentWithItems[]
  type: TabType
  onSelect: (doc: DocumentWithItems) => void
}) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FileText className="mb-2 h-8 w-8" />
        <p>Aucun document.</p>
      </div>
    )
  }

  const label = type === 'quotes' ? 'Devis' : type === 'invoices' ? 'Factures' : 'Bons de livraison'

  return (
    <div className="space-y-2">
      {items.map((doc) => (
        <button
          type="button"
          key={doc.id}
          onClick={() => onSelect(doc)}
          className="flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-accent"
        >
          <div className="space-y-0.5">
            <p className="font-medium">{doc.documentNumber}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(doc.issueDate).toLocaleDateString('fr-FR')} — {doc.status}
            </p>
          </div>
          <p className="font-semibold">{formatCurrency(doc.total, doc.currency)}</p>
        </button>
      ))}
      <p className="text-xs text-muted-foreground">
        {items.length} {label.toLowerCase()}
      </p>
    </div>
  )
}

function CreateForm({
  type,
  onClose,
}: {
  type: 'quote' | 'invoice' | 'delivery_note'
  onClose: () => void
}) {
  const { session } = useAuth()
  const createQuote = useCreateQuote()
  const createInvoice = useCreateInvoice()
  const createDeliveryNote = useCreateDeliveryNote()
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [taxRate, setTaxRate] = useState('0')
  const [discount, setDiscount] = useState('0')

  const orgId = session?.organization.id
  const currency = session?.organization.currency ?? 'XOF'

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!orgId) return
    const qty = Number(quantity) || 1
    const price = Number(unitPrice) || 0
    const tax = Number(taxRate) || 0
    const disc = Number(discount) || 0
    const line = {
      description,
      quantity: qty,
      unitPrice: price,
      taxRate: tax,
      discountAmount: disc,
    }
    const base = {
      orgId,
      currency,
      issueDate: new Date().toISOString().split('T')[0],
      items: [line],
    }

    try {
      if (type === 'quote') {
        await createQuote.mutateAsync(base)
      } else if (type === 'invoice') {
        await createInvoice.mutateAsync(base)
      } else {
        await createDeliveryNote.mutateAsync(base)
      }
      onClose()
    } catch (err) {
      console.error(err)
    }
  }

  const title =
    type === 'quote'
      ? 'Nouveau devis'
      : type === 'invoice'
        ? 'Nouvelle facture'
        : 'Nouveau bon de livraison'
  const pending = createQuote.isPending || createInvoice.isPending || createDeliveryNote.isPending

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <h4 className="font-medium">{title}</h4>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <label htmlFor="description" className="text-sm font-medium">
            Description
          </label>
          <input
            id="description"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="quantity" className="text-sm font-medium">
            Qté
          </label>
          <input
            id="quantity"
            type="number"
            min="1"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="unitPrice" className="text-sm font-medium">
            P.U.
          </label>
          <input
            id="unitPrice"
            type="number"
            min="0"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="taxRate" className="text-sm font-medium">
            Taux taxe (%)
          </label>
          <input
            id="taxRate"
            type="number"
            min="0"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={taxRate}
            onChange={(e) => setTaxRate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="discount" className="text-sm font-medium">
            Remise
          </label>
          <input
            id="discount"
            type="number"
            min="0"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        Créer
      </Button>
    </form>
  )
}

export default function InvoicingPage() {
  const { session } = useAuth()
  const orgId = session?.organization.id ?? ''
  const { data: quotes, isLoading: quotesLoading } = useQuotes(orgId)
  const { data: invoices, isLoading: invoicesLoading } = useInvoices(orgId)
  const { data: deliveryNotes, isLoading: dnLoading } = useDeliveryNotes(orgId)

  const [selectedDoc, setSelectedDoc] = useState<DocumentWithItems | null>(null)
  const [createType, setCreateType] = useState<'quote' | 'invoice' | 'delivery_note' | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('overview')

  const tabs: { value: TabType; label: string; data?: DocumentWithItems[]; loading: boolean }[] = [
    { value: 'overview', label: "Vue d'ensemble", data: undefined, loading: false },
    { value: 'quotes', label: 'Devis', data: quotes, loading: quotesLoading },
    { value: 'invoices', label: 'Factures', data: invoices, loading: invoicesLoading },
    {
      value: 'delivery-notes',
      label: 'Bons de livraison',
      data: deliveryNotes,
      loading: dnLoading,
    },
  ]

  const metrics = computeMetrics(quotes ?? [], invoices ?? [], deliveryNotes ?? [])
  const anyLoading = quotesLoading || invoicesLoading || dnLoading

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Facturation</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setCreateType('quote')}>
            <Plus className="mr-1 h-4 w-4" /> Devis
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateType('invoice')}>
            <Plus className="mr-1 h-4 w-4" /> Facture
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCreateType('delivery_note')}>
            <Plus className="mr-1 h-4 w-4" /> BL
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value: string) => setActiveTab(value as TabType)}>
        <TabsList className="grid w-full grid-cols-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-4">
            <h2 className="text-base font-semibold">Vue d'ensemble</h2>
            {anyLoading ? (
              <p className="text-sm text-muted-foreground">Chargement...</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <MetricCard
                    label="Total facturé"
                    value={formatCurrency(
                      metrics.totalInvoiced,
                      session?.organization.currency ?? 'XOF'
                    )}
                    icon={TrendingUp}
                  />
                  <MetricCard
                    label="Encaissé"
                    value={formatCurrency(
                      metrics.totalPaid,
                      session?.organization.currency ?? 'XOF'
                    )}
                    icon={CheckCircle}
                    variant="success"
                  />
                  <MetricCard
                    label="Impayé / en retard"
                    value={formatCurrency(
                      metrics.totalOverdue,
                      session?.organization.currency ?? 'XOF'
                    )}
                    icon={AlertCircle}
                    variant="danger"
                  />
                  <MetricCard
                    label="Devis en cours"
                    value={String(metrics.openQuotes)}
                    icon={FileText}
                    variant="warning"
                  />
                  <MetricCard
                    label="Factures à relancer"
                    value={String(metrics.sentInvoices)}
                    icon={Clock}
                    variant="warning"
                  />
                  <MetricCard
                    label="BL livrés"
                    value={String(metrics.deliveredNotes)}
                    icon={CheckCircle}
                    variant="success"
                  />
                </div>
              </>
            )}
          </div>
        </TabsContent>

        {tabs
          .filter((t) => t.value !== 'overview')
          .map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <div className="rounded-lg border bg-card p-4 shadow-sm">
                <h2 className="mb-3 text-base font-semibold">{t.label}</h2>
                {t.loading ? (
                  <p className="text-sm text-muted-foreground">Chargement...</p>
                ) : (
                  <DocumentList
                    items={t.data ?? []}
                    type={t.value}
                    onSelect={(doc) => setSelectedDoc(doc)}
                  />
                )}
              </div>
            </TabsContent>
          ))}
      </Tabs>

      <Dialog open={!!selectedDoc} onOpenChange={(open: boolean) => !open && setSelectedDoc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Détail du document</DialogTitle>
          </DialogHeader>
          {selectedDoc && (
            <DocumentActions
              doc={selectedDoc}
              type={
                selectedDoc.type === 'quote'
                  ? 'quote'
                  : selectedDoc.type === 'invoice'
                    ? 'invoice'
                    : 'delivery_note'
              }
              onClose={() => setSelectedDoc(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={createType != null}
        onOpenChange={(open: boolean) => !open && setCreateType(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Créer un document</DialogTitle>
          </DialogHeader>
          {createType && <CreateForm type={createType} onClose={() => setCreateType(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
