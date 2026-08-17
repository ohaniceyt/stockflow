import type { ProductBalanceRow } from '@/features/dashboard/services/dashboardService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface ProductBalanceTableProps {
  balances: ProductBalanceRow[]
}

interface BalanceRow {
  productId: string
  productName: string
  unit: string
  inQuantity: number
  outQuantity: number
  balance: number
}

const columns: ResponsiveColumn<BalanceRow>[] = [
  {
    key: 'product',
    header: 'Produit',
    cell: (item) => item.productName,
    className: 'font-medium',
  },
  {
    key: 'in',
    header: 'Entrées',
    cell: (item) => `${item.inQuantity.toLocaleString()} ${item.unit}`,
  },
  {
    key: 'out',
    header: 'Sorties',
    cell: (item) => `${item.outQuantity.toLocaleString()} ${item.unit}`,
  },
  {
    key: 'balance',
    header: 'Solde',
    cell: (item) => {
      const sign = item.balance > 0 ? '+' : item.balance < 0 ? '' : ''
      return (
        <span className={item.balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
          {sign}
          {item.balance.toLocaleString()} {item.unit}
        </span>
      )
    },
  },
]

export function ProductBalanceTable({ balances }: ProductBalanceTableProps) {
  const rows: BalanceRow[] = balances.map((b) => ({
    productId: b.product_id,
    productName: b.name,
    unit: b.unit,
    inQuantity: b.in_qty,
    outQuantity: b.out_qty,
    balance: b.in_qty - b.out_qty,
  }))

  const empty = (
    <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
      Aucun mouvement dans la période.
    </div>
  )

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Solde par produit
        </h3>
      </div>
      <ResponsiveTable
        data={rows}
        columns={columns}
        keyExtractor={(item) => item.productId}
        empty={empty}
        mobileCardTitle={(item) => item.productName}
      />
    </div>
  )
}
