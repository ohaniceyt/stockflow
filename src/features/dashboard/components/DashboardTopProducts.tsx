import { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import type { MovementWithDetails } from '@/features/movements/services/movementService'

interface DashboardTopProductsProps {
  movements: MovementWithDetails[]
}

export function DashboardTopProducts({ movements }: DashboardTopProductsProps) {
  const [limit, setLimit] = useState(5)

  const topProducts = useMemo(() => {
    const map = new Map<string, { id: string; name: string; quantity: number }>()
    movements
      .filter((m) => m.type === 'OUT' && !m.isCancelled)
      .forEach((m) => {
        const entry = map.get(m.productId) ?? {
          id: m.productId,
          name: m.productName ?? 'Produit inconnu',
          quantity: 0,
        }
        entry.quantity += m.quantity
        map.set(m.productId, entry)
      })
    return Array.from(map.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit)
  }, [movements, limit])

  const max = Math.max(...topProducts.map((p) => p.quantity), 1)

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="card-t">Top {limit} produits vendus</h3>
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
        <p className="dash-empty">Aucune vente enregistrée.</p>
      ) : (
        <ul className="space-y-3">
          {topProducts.map((product, index) => {
            const percent = (product.quantity / max) * 100
            const isTop = index < 3
            return (
              <li key={product.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-[var(--text-h)]">
                    <TrendingUp
                      className={`h-3.5 w-3.5 shrink-0 ${isTop ? 'text-[var(--emerald)]' : 'text-[var(--text-faint)]'}`}
                    />
                    <span className="truncate">{product.name}</span>
                  </span>
                  <span className="font-semibold text-[var(--text-h)]">
                    {product.quantity.toLocaleString('fr-FR')}
                  </span>
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
