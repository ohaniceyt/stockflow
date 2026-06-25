import { useMemo } from 'react'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import type { StockItem } from '@/features/stock/services/stockService'

interface DashboardRotationProps {
  stock: StockItem[]
  movements: MovementWithDetails[]
}

export function DashboardRotation({ stock, movements }: DashboardRotationProps) {
  const rows = useMemo(() => {
    const outByProduct = new Map<string, number>()
    movements
      .filter((m) => m.type === 'OUT')
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
      <div className="card p-4">
        <h3 className="card-t">Taux de rotation</h3>
        <p className="dash-empty">Données insuffisantes.</p>
      </div>
    )
  }

  return (
    <div className="card p-4">
      <h3 className="card-t">Taux de rotation</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-[var(--text-faint)]">
              <th className="pb-2 font-medium">Produit</th>
              <th className="pb-2 font-medium text-right">Sorties</th>
              <th className="pb-2 font-medium text-right">Stock</th>
              <th className="pb-2 font-medium text-right">Rotation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.productId} className="border-b border-[var(--border)] last:border-0">
                <td className="max-w-[40%] truncate py-2 font-medium text-[var(--text-h)]">
                  {row.name}
                </td>
                <td className="py-2 text-right text-[var(--text)]">
                  {row.outQty.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 text-right text-[var(--text)]">
                  {row.stockQty.toLocaleString('fr-FR')}
                </td>
                <td className="py-2 text-right font-semibold text-[var(--indigo)]">
                  {row.rotation.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
