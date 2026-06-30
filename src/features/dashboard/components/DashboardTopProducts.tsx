import { useMemo, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import type { MovementWithDetails } from '@/features/movements/services/movementService'
import { Button } from '@/components/ui/button'

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
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Top {limit} produits vendus
        </h3>
        <div className="flex gap-1.5">
          {[5, 10].map((n) => (
            <Button
              key={n}
              type="button"
              size="sm"
              variant={limit === n ? 'default' : 'outline'}
              onClick={() => setLimit(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      {topProducts.length === 0 ? (
        <p className="py-8 text-center text-base text-muted-foreground">
          Aucune vente enregistrée.
        </p>
      ) : (
        <ul className="space-y-3">
          {topProducts.map((product, index) => {
            const percent = (product.quantity / max) * 100
            const isTop = index < 3
            return (
              <li key={product.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <TrendingUp
                      className={`h-3.5 w-3.5 shrink-0 ${isTop ? 'text-emerald-500' : 'text-muted-foreground'}`}
                    />
                    <span className="truncate">{product.name}</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {product.quantity.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all ${isTop ? 'bg-emerald-500' : 'bg-rose-500'}`}
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
