import { useAuth } from '@/features/auth/context/AuthContext'
import type { StockItem } from '@/features/stock/services/stockService'
import { Banknote, AlertTriangle, PackageCheck, Boxes } from 'lucide-react'

interface DashboardStatsProps {
  stock: StockItem[]
  productCount: number
}

export function DashboardStats({ stock, productCount }: DashboardStatsProps) {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['super_admin', 'admin'])

  const ruptures = stock.filter((item) => item.quantity <= 0)
  const alertes = stock.filter((item) => item.quantity > 0 && item.quantity <= item.threshold)
  const stockValue = stock.reduce((sum, item) => sum + item.quantity * item.costPrice, 0)

  const cards = [
    {
      label: 'Valeur stock',
      value: isAdmin ? `${stockValue.toLocaleString('fr-FR')} FCFA` : '—',
      sub: 'Valeur totale',
      icon: Banknote,
      colorClass: 'ca',
      barClass: 'bg-[var(--indigo)]',
    },
    {
      label: 'Ruptures',
      value: String(ruptures.length),
      sub: 'Produits épuisés',
      icon: AlertTriangle,
      colorClass: 'cr',
      barClass: 'bg-[var(--rose)]',
    },
    {
      label: 'Alertes',
      value: String(alertes.length),
      sub: 'Stock faible',
      icon: PackageCheck,
      colorClass: 'cy',
      barClass: 'bg-[var(--amber)]',
    },
    {
      label: 'Produits',
      value: String(productCount),
      sub: 'Références',
      icon: Boxes,
      colorClass: 'ca',
      barClass: 'bg-[var(--indigo)]',
    },
  ]

  return (
    <div className="sg">
      {cards.map((card) => (
        <div key={card.label} className="sc text-left">
          <span className={`sc-bar ${card.barClass}`} />
          <div className="mb-3 flex items-start justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-faint)]">
              {card.label}
            </span>
            <span className={`rounded-md p-1.5 ${card.colorClass}`}>
              <card.icon className="h-4 w-4" />
            </span>
          </div>
          <p className={`text-2xl font-bold text-[var(--text-h)] sm:text-3xl`}>{card.value}</p>
          <p className="mt-1 text-xs text-[var(--text-faint)]">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
