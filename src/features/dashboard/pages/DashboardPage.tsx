import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { PullToRefresh } from '@/features/stock/components/PullToRefresh'
import { StockDetailOverlay } from '@/features/stock/components/StockDetailOverlay'
import type { StockItem } from '@/features/stock/services/stockService'
import { PinSetupPrompt } from '@/features/auth/components/PinSetupPrompt'
import { DashboardHeader } from '../components/DashboardHeader'
import { DashboardStats } from '../components/DashboardStats'
import { DashboardFluxChart } from '../components/DashboardFluxChart'
import { DashboardTrendChart } from '../components/DashboardTrendChart'
import { DashboardTopProducts } from '../components/DashboardTopProducts'
import { DashboardRotation } from '../components/DashboardRotation'
import { DashboardAlerts } from '../components/DashboardAlerts'
import { DashboardRecentMovements } from '../components/DashboardRecentMovements'

export default function DashboardPage() {
  const { data: products, isPending: productsPending, refetch: refetchProducts } = useProducts()
  const { data: stock, isPending: stockPending, refetch: refetchStock } = useStock()
  const { data: movements, isPending: movementsPending, refetch: refetchMovements } = useMovements()
  const queryClient = useQueryClient()

  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  const isPending = productsPending || stockPending || movementsPending

  const stockItems = stock ?? []
  const activeProducts = products?.filter((p) => p.isActive) ?? []

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products'] }),
      queryClient.invalidateQueries({ queryKey: ['stock'] }),
      queryClient.invalidateQueries({ queryKey: ['movements'] }),
    ])
    await Promise.all([refetchProducts(), refetchStock(), refetchMovements()])
  }

  const handleSelectProduct = (productId: string, productName?: string) => {
    const item = stockItems.find((s) => s.productId === productId)
    if (item) {
      setSelectedItem(item)
    } else {
      // Fallback item when product has no stock yet
      setSelectedItem({
        id: productId,
        productId,
        productName: productName ?? 'Produit inconnu',
        productUnit: 'unité',
        category: null,
        barcode: null,
        threshold: 0,
        costPrice: 0,
        sellingPrice: 0,
        locationId: '',
        locationName: '—',
        quantity: 0,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  const recentMovements = useMemo(() => {
    return [...(movements ?? [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [movements])

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isPending}>
      <div className="space-y-4 pb-6">
        <DashboardHeader onRefresh={handleRefresh} isRefreshing={isPending} />

        {isPending ? (
          <p className="py-8 text-center text-sm text-[var(--text-faint)]">
            Chargement du tableau de bord…
          </p>
        ) : (
          <>
            <DashboardStats stock={stockItems} productCount={activeProducts.length} />

            <div className="card p-4">
              <h3 className="card-t">Flux 7 jours</h3>
              <DashboardFluxChart movements={movements ?? []} />
            </div>

            <DashboardTrendChart movements={movements ?? []} />

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardTopProducts movements={movements ?? []} />
              <DashboardRotation stock={stockItems} movements={movements ?? []} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardAlerts stock={stockItems} onSelectItem={setSelectedItem} />
              <DashboardRecentMovements
                movements={recentMovements}
                onSelectProduct={handleSelectProduct}
              />
            </div>
          </>
        )}

        <StockDetailOverlay item={selectedItem} onClose={() => setSelectedItem(null)} />
        <PinSetupPrompt />
      </div>
    </PullToRefresh>
  )
}
