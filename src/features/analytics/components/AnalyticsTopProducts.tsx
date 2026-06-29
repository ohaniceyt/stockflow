import { useMemo, useState } from 'react'
import { TrendingUp, Banknote } from 'lucide-react'
import type { Product } from '@/types'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface AnalyticsTopProductsProps {
  movements: MovementWithDetails[]
  productMap: Map<string, Product>
  currency: string
}

interface TopProduct {
  id: string
  name: string
  quantity: number
  revenue: number
}

export function AnalyticsTopProducts({
  movements,
  productMap,
  currency,
}: AnalyticsTopProductsProps) {
  const [limit, setLimit] = useState(5)

  const topProducts = useMemo(() => {
    const map = new Map<string, TopProduct>()
    movements
      .filter((m) => m.type === 'OUT' && !m.isCancelled)
      .forEach((m) => {
        const product = productMap.get(m.productId)
        const price = m.unitPrice ?? product?.sellingPrice ?? 0
        const entry = map.get(m.productId) ?? {
          id: m.productId,
          name: m.productName ?? product?.name ?? 'Produit inconnu',
          quantity: 0,
          revenue: 0,
        }
        entry.quantity += m.quantity
        entry.revenue += m.quantity * price
        map.set(m.productId, entry)
      })
    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
  }, [movements, productMap, limit])

  const maxQuantity = Math.max(...topProducts.map((p) => p.quantity), 1)

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-[var(--emerald)]" />
          <h3 className="card-t mb-0">Top {limit} produits vendus</h3>
        </div>
        <div className="flex gap-1.5">
          {[5, 10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLimit(n)}
              className={`${limit === n ? 'btn-p' : 'btn-o'} btn-sm`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {topProducts.length === 0 ? (
        <p className="dash-empty">Aucune vente enregistrée sur la période.</p>
      ) : (
        <ul className="space-y-3">
          {topProducts.map((product, index) => {
            const percent = (product.quantity / maxQuantity) * 100
            const isTop = index < 3
            return (
              <li key={product.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--text-h)]">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="truncate">{product.name}</span>
                  </span>
                  <span className="font-semibold text-[var(--text-h)]">
                    {product.quantity.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--text-faint)]">
                  <Banknote className="h-3.5 w-3.5" />
                  {product.revenue.toLocaleString('fr-FR')} {currency} de CA
                </div>
                <div className="progress-track">
                  <div
                    className={`h-full rounded-full ${isTop ? 'bg-[var(--emerald)]' : 'bg-[var(--rose)]'}`}
                    style={{ width: `${String(Math.min(percent, 100))}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
