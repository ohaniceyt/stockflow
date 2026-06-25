import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { useAuth } from '@/features/auth/context/AuthContext'
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

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="h-5 w-32 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-[var(--surface-2)]" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-[var(--surface-2)]" />
      </div>
      <p className="sr-only">{label}</p>
    </div>
  )
}

export default function DashboardPage() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const { data: products, isPending: productsPending, error: productsError } = useProducts()
  const { data: stock, isPending: stockPending, error: stockError } = useStock()
  const { data: movements, isPending: movementsPending, error: movementsError } = useMovements()
  const queryClient = useQueryClient()

  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  const isPending = productsPending || stockPending || movementsPending
  const errors = [productsError, stockError, movementsError].filter(Boolean)
  const queryError = errors.length > 0 ? errors : null

  const stockItems = stock ?? []
  const activeProducts = products?.filter((p) => p.isActive) ?? []

  const handleRefresh = async () => {
    if (!orgId) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products', orgId] }),
      queryClient.invalidateQueries({ queryKey: ['stock', orgId] }),
      queryClient.invalidateQueries({ queryKey: ['movements', orgId] }),
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'movements-by-product',
      }),
    ])
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

        {queryError && (
          <p className="rounded-lg border border-[var(--rose)] bg-[var(--rose-light)] p-3 text-sm text-[var(--rose)]">
            {queryError.length === 1
              ? queryError[0]?.message
              : `Erreurs de chargement : ${queryError.map((e) => e?.message ?? 'inconnue').join(', ')}`}
          </p>
        )}

        {isPending && (
          <div className="space-y-4">
            <SectionSkeleton label="Chargement des statistiques" />
            <SectionSkeleton label="Chargement du flux" />
            <SectionSkeleton label="Chargement de la tendance" />
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionSkeleton label="Chargement du top produits" />
              <SectionSkeleton label="Chargement de la rotation" />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <SectionSkeleton label="Chargement des alertes" />
              <SectionSkeleton label="Chargement des derniers mouvements" />
            </div>
          </div>
        )}

        {!isPending && (
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
