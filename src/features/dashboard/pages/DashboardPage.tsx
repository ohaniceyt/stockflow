import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { DashboardStats } from '../components/DashboardStats'
import { DashboardChart } from '../components/DashboardChart'
import { MovementList } from '@/features/movements/components/MovementList'

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export default function DashboardPage() {
  const { data: products } = useProducts()
  const { data: stock } = useStock()
  const { data: movements } = useMovements()

  const activeProducts = products?.filter((p) => p.isActive) ?? []
  const stockItems = stock ?? []
  const allMovements = movements ?? []

  const lowStockCount = stockItems.filter(
    (item) => item.quantity === 0 || item.quantity <= item.threshold
  ).length
  const totalQuantity = stockItems.reduce((sum, item) => sum + item.quantity, 0)
  const today = new Date()
  const movementsToday = allMovements.filter((m) => isSameDay(new Date(m.createdAt), today)).length

  const recentMovements = allMovements.slice(0, 10)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground">Vue d'ensemble de votre stock et activité récente.</p>
      </div>

      <DashboardStats
        productCount={activeProducts.length}
        lowStockCount={lowStockCount}
        totalQuantity={totalQuantity}
        movementsToday={movementsToday}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <DashboardChart movements={allMovements} />
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <h3 className="mb-4 text-sm font-medium text-muted-foreground">Derniers mouvements</h3>
          <MovementList movements={recentMovements} />
        </div>
      </div>
    </div>
  )
}
