import { cn } from '@/lib/utils'
import { Package, AlertTriangle, Warehouse, TrendingUp } from 'lucide-react'

interface RecapStatsProps {
  productCount: number
  lowStockCount: number
  totalQuantity: number
  stockValue: number
  currency: string
}

export function RecapStats({
  productCount,
  lowStockCount,
  totalQuantity,
  stockValue,
  currency,
}: RecapStatsProps) {
  const cards = [
    {
      label: 'Produits actifs',
      value: productCount,
      icon: Package,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Stock faible / rupture',
      value: lowStockCount,
      icon: AlertTriangle,
      color: 'text-amber-600',
      bg: 'bg-amber-50',
    },
    {
      label: 'Quantité totale en stock',
      value: totalQuantity,
      icon: Warehouse,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: `Valeur du stock (${currency})`,
      value: stockValue,
      icon: TrendingUp,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      format: (v: number) =>
        v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-3xl font-bold">
                {card.format ? card.format(card.value) : card.value.toLocaleString()}
              </p>
            </div>
            <div className={cn('rounded-lg p-2', card.bg)}>
              <card.icon className={cn('h-5 w-5', card.color)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
