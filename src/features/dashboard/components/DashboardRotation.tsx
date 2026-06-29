import { useMemo } from 'react'
import { ArrowRightLeft } from 'lucide-react'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import type { StockItem } from '@/features/stock/services/stockService'
import { EmptyState } from '@/components/design-system'

interface DashboardRotationProps {
  stock: StockItem[]
  movements: MovementWithDetails[]
}

export function DashboardRotation({ stock, movements }: DashboardRotationProps) {
  const rows = useMemo(() => {
    const outByProduct = new Map<string, number>()
    movements
      .filter((m) => m.type === 'OUT' && !m.isCancelled)
      .forEach((m) => {
        outByProduct.set(m.productId, (outByProduct.get(m.productId) ?? 0) + m.quantity)
      })

    const stockByProduct = new Map<string, StockItem>()
    stock.forEach((item) => {
      const current = stockByProduct.get(item.productId)
      if (!current || item.quantity > current.quantity) {
        stockByProduct.set(item.productId, item)
      }
    })

    return Array.from(outByProduct.entries())
      .map(([productId, outQty]) => {
        const item = stockByProduct.get(productId)
        const stockQty = item?.quantity ?? 0
        return {
          productId,
          name: item?.productName ?? 'Produit inconnu',
          outQty,
          stockQty,
          rotation: stockQty > 0 ? outQty / stockQty : 0,
        }
      })
      .filter((row) => row.outQty > 0)
      .sort((a, b) => b.rotation - a.rotation)
      .slice(0, 10)
  }, [stock, movements])

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Taux de rotation
        </h3>
        <EmptyState
          icon={ArrowRightLeft}
          title="Données insuffisantes"
          description="Enregistrez des sorties et du stock pour voir les taux de rotation."
        />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Taux de rotation
      </h3>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Produit</th>
              <th className="pb-2 font-medium text-right">Sorties</th>
              <th className="pb-2 font-medium text-right">Stock</th>
              <th className="pb-2 font-medium text-right">Rotation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className="border-b last:border-0">
                <td className="max-w-[40%] truncate py-2 font-medium text-foreground">
                  {row.name}
                </td>
                <td className="py-2 text-right text-foreground">
                  {row.outQty.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 text-right text-foreground">
                  {row.stockQty.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 text-right font-semibold text-indigo-600">
                  {row.rotation.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={row.productId}
            className="rounded-lg border bg-background p-3"
          >
            <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">
                  {row.outQty.toLocaleString('fr-FR')}
                </p>
                <p>Sorties</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  {row.stockQty.toLocaleString('fr-FR')}
                </p>
                <p>Stock</p>
              </div>
              <div>
                <p className="font-semibold text-indigo-600">{row.rotation.toFixed(2)}</p>
                <p>Rotation</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
