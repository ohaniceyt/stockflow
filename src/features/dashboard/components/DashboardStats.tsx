import { useAuth } from '@/features/auth/context/AuthContext'
import type { StockItem } from '@/features/stock/services/stockService'
import { Warehouse, AlertTriangle, PackageCheck, Boxes } from 'lucide-react'
import { DataCard } from '@/components/design-system'

interface DashboardStatsProps {
  stock: StockItem[]
  productCount: number
}

export function DashboardStats({ stock, productCount }: DashboardStatsProps) {
  const { hasRole } = useAuth()
  const isAdmin = hasRole(['super_admin', 'admin'])

  const ruptures = stock.filter((item) => item.quantity <= 0)
  const alertes = stock.filter((item) => item.quantity > 0 && item.quantity <= item.threshold)
  const totalQuantity = stock.reduce((sum, item) => sum + item.quantity, 0)

  const cards = [
    {
      label: 'Qté totale en stock',
      value: isAdmin ? totalQuantity.toLocaleString('fr-FR') : '—',
      subtitle: 'Quantité totale',
      icon: Warehouse,
      status: 'info' as const,
    },
    {
      label: 'Ruptures',
      value: String(ruptures.length),
      subtitle: 'Produits épuisés',
      icon: AlertTriangle,
      status: 'danger' as const,
    },
    {
      label: 'Alertes',
      value: String(alertes.length),
      subtitle: 'Stock faible',
      icon: PackageCheck,
      status: 'warning' as const,
    },
    {
      label: 'Produits',
      value: String(productCount),
      subtitle: 'Références',
      icon: Boxes,
      status: 'info' as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <DataCard key={card.label} {...card} />
      ))}
    </div>
  )
}
