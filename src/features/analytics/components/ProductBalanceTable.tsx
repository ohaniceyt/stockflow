import type { Product } from '@/types'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface ProductBalanceTableProps {
  movements: MovementWithDetails[]
  products: Product[]
}

interface BalanceRow {
  productId: string
  productName: string
  unit: string
  inQuantity: number
  outQuantity: number
  balance: number
}

export function ProductBalanceTable({ movements, products }: ProductBalanceTableProps) {
  const balances = products.map((product): BalanceRow => {
    const productMovements = movements.filter((m) => m.productId === product.id)
    const inQuantity = productMovements
      .filter((m) => m.type === 'IN')
      .reduce((sum, m) => sum + m.quantity, 0)
    const outQuantity = productMovements
      .filter((m) => m.type === 'OUT')
      .reduce((sum, m) => sum + m.quantity, 0)

    return {
      productId: product.id,
      productName: product.name,
      unit: product.unit,
      inQuantity,
      outQuantity,
      balance: inQuantity - outQuantity,
    }
  })

  const rows = balances.filter((b) => b.inQuantity > 0 || b.outQuantity > 0)

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
