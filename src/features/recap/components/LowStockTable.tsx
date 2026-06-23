import type { StockItem } from '@/features/stock/services/stockService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface LowStockTableProps {
  items: StockItem[]
}

export function LowStockTable({ items }: LowStockTableProps) {
  const columns: ResponsiveColumn<StockItem>[] = [
    {
      key: 'product',
      header: 'Produit',
      cell: (item) => item.productName,
      className: 'font-medium',
    },
    { key: 'location', header: 'Emplacement', cell: (item) => item.locationName },
    {
      key: 'quantity',
      header: 'Quantité',
      cell: (item) => `${item.quantity.toLocaleString()} ${item.productUnit}`,
    },
    {
      key: 'threshold',
      header: 'Seuil',
      cell: (item) => `${item.threshold.toLocaleString()} ${item.productUnit}`,
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (item) => {
        const isOut = item.quantity === 0
        return isOut ? (
          <span className="inline-flex items-center rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-semibold text-destructive">
            Rupture
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-600">
            Faible
          </span>
        )
      },
    },
  ]

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucun stock faible ou en rupture.
    </div>
  )

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-medium text-muted-foreground">Stocks faibles / ruptures</h3>
      </div>
      <ResponsiveTable
        data={items}
        columns={columns}
        keyExtractor={(item) => item.id}
        empty={empty}
        mobileCardTitle={(item) => item.productName}
      />
    </div>
  )
}
