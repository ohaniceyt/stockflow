import { useState } from 'react'
import { TrendingUp, Banknote } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { TopProductRow } from '@/features/dashboard/services/dashboardService'

interface AnalyticsTopProductsProps {
  topProducts: TopProductRow[]
  currency: string
}

export function AnalyticsTopProducts({ topProducts, currency }: AnalyticsTopProductsProps) {
  const [limit, setLimit] = useState(5)
  const products = topProducts.slice(0, limit)
  const maxQuantity = Math.max(...products.map((p) => p.qty_sold), 1)

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Top {limit} produits vendus
          </h3>
        </div>
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

      {products.length === 0 ? (
        <p className="py-8 text-center text-base text-muted-foreground">
          Aucune vente enregistrée sur la période.
        </p>
      ) : (
        <ul className="space-y-3">
          {products.map((product, index) => {
            const percent = (product.qty_sold / maxQuantity) * 100
            const isTop = index < 3
            return (
              <li key={product.product_id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {index + 1}
                    </span>
                    <span className="truncate">{product.name}</span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {product.qty_sold.toLocaleString('fr-FR')}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Banknote className="h-3.5 w-3.5" />
                  {product.revenue.toLocaleString('fr-FR')} {currency} de CA
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
