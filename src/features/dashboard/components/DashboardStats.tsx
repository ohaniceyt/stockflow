import { cn } from '@/lib/utils'
import { Package, AlertTriangle, ArrowLeftRight, Warehouse } from 'lucide-react'

interface DashboardStatsProps {
  productCount: number
  lowStockCount: number
  totalQuantity: number
  movementsToday: number
}

export function DashboardStats({
  productCount,
  lowStockCount,
  totalQuantity,
  movementsToday,
}: DashboardStatsProps) {
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
      label: "Mouvements aujourd'hui",
      value: movementsToday,
      icon: ArrowLeftRight,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{card.label}</p>
              <p className="mt-1 text-3xl font-bold">{card.value.toLocaleString()}</p>
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
