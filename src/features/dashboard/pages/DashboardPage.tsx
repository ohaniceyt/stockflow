import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { addDays, format, formatISO, isValid, min as minDate, startOfDay, subDays } from 'date-fns'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { useAuth } from '@/features/auth/context/AuthContext'
import { PullToRefresh } from '@/features/stock/components/PullToRefresh'
import { StockDetailOverlay } from '@/features/stock/components/StockDetailOverlay'
import type { StockItem } from '@/features/stock/services/stockService'
import { PinSetupPrompt } from '@/features/auth/components/PinSetupPrompt'
import { PageSection } from '@/components/design-system'
import { DashboardHeader } from '../components/DashboardHeader'
import { DashboardStats } from '../components/DashboardStats'
import { DashboardFluxChart } from '../components/DashboardFluxChart'
import { DashboardTrendChart } from '../components/DashboardTrendChart'
import { DashboardTopProducts } from '../components/DashboardTopProducts'
import { DashboardRotation } from '../components/DashboardRotation'
import { DashboardAlerts } from '../components/DashboardAlerts'
import { DashboardRecentMovements } from '../components/DashboardRecentMovements'
import { useMovementStats, MOVEMENT_STATS_KEY } from '../hooks/useMovementStats'

type TrendPeriod = 30 | 90 | 'custom'

function SectionSkeleton({ label }: { label: string }) {
  return (
    <PageSection title={label}>
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    </PageSection>
  )
}

function StatCardSkeleton() {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
      <span className="absolute left-0 right-0 top-0 h-1 bg-border" />
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        <div className="h-7 w-7 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-8 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-muted" />
    </div>
  )
}

export default function DashboardPage() {
  const { session } = useAuth()
  const orgId = session?.membership.orgId
  const { data: products, isPending: productsPending, error: productsError } = useProducts()
  const { data: stock, isPending: stockPending, error: stockError } = useStock()
  const { data: movements, isLoading: movementsLoading, error: movementsError } = useMovements()
  const queryClient = useQueryClient()

  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  // Trend selection lives here so the stats RPC can be scoped to the same window.
  const todayStart = useMemo(() => startOfDay(new Date()), [])
  const [period, setPeriod] = useState<TrendPeriod>(30)
  const [startDate, setStartDate] = useState<string>(() =>
    format(subDays(todayStart, 29), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState<string>(() => format(todayStart, 'yyyy-MM-dd'))

  const trendFrom = useMemo(() => {
    if (period === 'custom') {
      const d = startOfDay(new Date(startDate))
      return isValid(d) ? d : todayStart
    }
    return subDays(todayStart, period - 1)
  }, [period, startDate, todayStart])

  const trendTo = useMemo(() => {
    if (period === 'custom') {
      const d = startOfDay(new Date(endDate))
      return isValid(d) ? d : todayStart
    }
    return todayStart
  }, [period, endDate, todayStart])

  // Single RPC call covering both the trend window and the last-7-days flux.
  // range = [earliest of (trendFrom, today-6d), today+1d)  (half-open, in local tz).
  const statsRange = useMemo(() => {
    const rpcFrom = minDate([trendFrom, subDays(todayStart, 6)])
    const rpcTo = addDays(todayStart, 1)
    return { from: formatISO(rpcFrom), to: formatISO(rpcTo) }
  }, [trendFrom, todayStart])

  const { data: stats, isPending: statsPending, error: statsError } = useMovementStats(statsRange)

  const isPending = productsPending || stockPending || movementsLoading || statsPending
  const errors = [productsError, stockError, movementsError, statsError].filter(Boolean)
  const queryError = errors.length > 0 ? errors : null

  const stockItems = stock ?? []
  const activeProducts = products?.filter((p) => p.isActive) ?? []

  const handleRefresh = async () => {
    if (!orgId) return
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['products', orgId] }),
      queryClient.invalidateQueries({ queryKey: ['stock', orgId] }),
      queryClient.invalidateQueries({ queryKey: ['movements', orgId] }),
      queryClient.invalidateQueries({ queryKey: [MOVEMENT_STATS_KEY, orgId] }),
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
    return [...movements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }, [movements])

  const dailyFlux = stats?.daily_flux ?? []
  const topProducts = stats?.top_products ?? []
  const rotation = stats?.rotation ?? []
  const trendFromStr = format(trendFrom, 'yyyy-MM-dd')
  const trendToStr = format(trendTo, 'yyyy-MM-dd')

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isPending}>
      <div className="space-y-6 md:space-y-8">
        <DashboardHeader onRefresh={handleRefresh} isRefreshing={isPending} />

        {queryError && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-base text-rose-700">
            {queryError.length === 1
              ? queryError[0]?.message
              : `Erreurs de chargement : ${queryError.map((e) => e?.message ?? 'inconnue').join(', ')}`}
          </p>
        )}

        {isPending && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
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

            <PageSection title="Flux 7 jours">
              <DashboardFluxChart daily={dailyFlux} />
            </PageSection>

            <DashboardTrendChart
              daily={dailyFlux}
              rangeFrom={trendFromStr}
              rangeTo={trendToStr}
              period={period}
              startDate={startDate}
              endDate={endDate}
              onPeriodChange={setPeriod}
              onStartChange={setStartDate}
              onEndChange={setEndDate}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <DashboardTopProducts topProducts={topProducts} />
              <DashboardRotation rotation={rotation} />
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
