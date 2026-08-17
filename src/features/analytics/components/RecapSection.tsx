import { useMemo, useState } from 'react'
import { addDays, format, formatISO, isAfter, isValid, startOfDay, subDays } from 'date-fns'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { useMovementStats } from '@/features/dashboard/hooks/useMovementStats'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RecapStats } from './RecapStats'
import { RecapChart } from './RecapChart'
import { ProductBalanceTable } from './ProductBalanceTable'
import { RecapMovementsTable } from './RecapMovementsTable'
import { ExportActions } from './ExportActions'
import { AnalyticsTopProducts } from './AnalyticsTopProducts'

type PeriodMode = 'today' | 'week' | 'month' | 'custom'

const PERIOD_OPTIONS: { key: PeriodMode; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'custom', label: 'Dates' },
]

export interface RecapSectionProps {
  embedded?: boolean
}

export function RecapSection({ embedded = false }: RecapSectionProps) {
  const { session, hasRole } = useAuth()
  const currency = session?.organization.currency ?? 'XOF'
  const orgName = session?.organization.name ?? 'StockFlow'
  const canViewFinancials = hasRole(['super_admin', 'admin'])

  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [startDate, setStartDate] = useState<string>(() =>
    format(subDays(new Date(), 6), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'))
  const [dateError, setDateError] = useState<string | null>(null)

  const { data: products, isLoading: productsLoading, error: productsError } = useProducts()
  const { data: stock, isLoading: stockLoading, error: stockError } = useStock()
  const { data: movements, isLoading: movementsLoading, error: movementsError } = useMovements()

  const activeProducts = useMemo(() => products?.filter((p) => p.isActive) ?? [], [products])
  const stockItems = useMemo(() => stock ?? [], [stock])
  const productMap = useMemo(() => new Map(products?.map((p) => [p.id, p]) ?? []), [products])

  const periodRange = useMemo(() => {
    const today = startOfDay(new Date())
    switch (periodMode) {
      case 'today':
        return { start: today, end: today, label: "Aujourd'hui" }
      case 'week': {
        const start = startOfDay(subDays(today, 6))
        return { start, end: today, label: '7 derniers jours' }
      }
      case 'month': {
        const start = startOfDay(subDays(today, 29))
        return { start, end: today, label: '30 derniers jours' }
      }
      case 'custom': {
        const parsedStart = startDate ? new Date(startDate) : today
        const parsedEnd = endDate ? new Date(endDate) : today
        const start = isValid(parsedStart) ? startOfDay(parsedStart) : today
        const end = isValid(parsedEnd) ? startOfDay(parsedEnd) : today
        return {
          start,
          end,
          label: `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`,
        }
      }
    }
  }, [periodMode, startDate, endDate])

  // Half-open server range [start, end+1day). Stats come from the RPC; the raw
  // movements list (table + export dump) stays on useMovements (recent, paginated).
  const statsRange = useMemo(
    () => ({ from: formatISO(periodRange.start), to: formatISO(addDays(periodRange.end, 1)) }),
    [periodRange]
  )
  const { data: stats, isPending: statsPending, error: statsError } = useMovementStats(statsRange)

  const isLoading = productsLoading || stockLoading || movementsLoading || statsPending
  const queryError = productsError ?? stockError ?? movementsError ?? statsError

  // Raw recent movements, filtered to the selected period for the table + raw export
  // dump. NB: capped at the page size — known caveat, the résumés use the RPC.
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const mDate = startOfDay(new Date(m.createdAt))
      return (
        (isAfter(mDate, periodRange.start) || mDate.getTime() === periodRange.start.getTime()) &&
        (mDate.getTime() <= periodRange.end.getTime() ||
          mDate.getTime() === periodRange.end.getTime())
      )
    })
  }, [movements, periodRange])

  const totalQuantity = useMemo(
    () => stockItems.reduce((sum, item) => sum + item.quantity, 0),
    [stockItems]
  )

  const stockValue = useMemo(() => {
    return stockItems.reduce((sum, item) => {
      const product = productMap.get(item.productId)
      return sum + item.quantity * (product?.costPrice ?? 0)
    }, 0)
  }, [stockItems, productMap])

  const stockSellingValue = useMemo(() => {
    return stockItems.reduce((sum, item) => {
      const product = productMap.get(item.productId)
      return sum + item.quantity * (product?.sellingPrice ?? 0)
    }, 0)
  }, [stockItems, productMap])

  const totals = stats?.totals
  const estimatedRevenue = totals?.estimated_revenue ?? 0
  const estimatedMargin = totals?.estimated_margin ?? 0
  const realRevenue = totals?.real_revenue ?? 0
  const realProfit = totals?.real_profit ?? 0
  const realMarginRate = useMemo(() => {
    if (realRevenue <= 0) return 0
    return Math.round((realProfit / realRevenue) * 10000) / 100
  }, [realRevenue, realProfit])
  const inCount = totals?.in_count ?? 0
  const outCount = totals?.out_count ?? 0

  const validateRange = (start: string, end: string) => {
    const s = new Date(start)
    const e = new Date(end)
    if (isValid(s) && isValid(e) && isAfter(startOfDay(s), startOfDay(e))) {
      setDateError('La date de début doit être antérieure à la date de fin.')
    } else {
      setDateError(null)
    }
  }

  const handleStartChange = (value: string) => {
    setStartDate(value)
    validateRange(value, endDate)
  }

  const handleEndChange = (value: string) => {
    setEndDate(value)
    validateRange(startDate, value)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {embedded ? (
            <>
              <h2 className="text-lg font-semibold">Analytics</h2>
              <p className="text-sm text-muted-foreground">
                Synthèse périodique des mouvements et du stock.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Analytics</h1>
              <p className="text-muted-foreground">
                Synthèse périodique des mouvements et du stock.
              </p>
            </>
          )}
        </div>
        <ExportActions
          periodLabel={periodRange.label}
          movements={filteredMovements}
          stock={stockItems}
          products={activeProducts}
          stats={stats}
          currency={currency}
          orgName={orgName}
          redactFinancials={!canViewFinancials}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map((p) => (
            <Button
              key={p.key}
              variant={periodMode === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodMode(p.key)}
              className="data-[state=selected]:bg-primary data-[state=selected]:text-primary-foreground"
            >
              {p.label}
            </Button>
          ))}
        </div>

        {periodMode === 'custom' && (
          <div className="rounded-xl border bg-card p-5 shadow-sm md:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Période personnalisée
              </h3>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="space-y-2 sm:flex-1">
                <Label htmlFor={`${embedded ? 'dashboard-' : ''}analytics-start`}>Du</Label>
                <Input
                  id={`${embedded ? 'dashboard-' : ''}analytics-start`}
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartChange(e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:flex-1">
                <Label htmlFor={`${embedded ? 'dashboard-' : ''}analytics-end`}>Au</Label>
                <Input
                  id={`${embedded ? 'dashboard-' : ''}analytics-end`}
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndChange(e.target.value)}
                />
              </div>
            </div>
            {dateError && <p className="mt-3 text-sm text-destructive">{dateError}</p>}
          </div>
        )}
      </div>

      {queryError && <p className="text-destructive">{queryError.message}</p>}

      {isLoading ? (
        <p className="text-muted-foreground">Chargement d’Analytics…</p>
      ) : (
        <>
          <RecapStats
            totalQuantity={totalQuantity}
            stockValue={stockValue}
            stockSellingValue={stockSellingValue}
            estimatedRevenue={estimatedRevenue}
            estimatedMargin={estimatedMargin}
            realRevenue={realRevenue}
            realProfit={realProfit}
            realMarginRate={realMarginRate}
            inCount={inCount}
            outCount={outCount}
            currency={currency}
            canViewFinancials={canViewFinancials}
          />

          {!dateError && (
            <RecapChart
              daily={stats?.daily_flux ?? []}
              startDate={periodRange.start}
              endDate={periodRange.end}
            />
          )}

          <AnalyticsTopProducts topProducts={stats?.top_products ?? []} currency={currency} />

          <div className="grid gap-6 lg:grid-cols-2">
            <ProductBalanceTable balances={stats?.product_balances ?? []} />
            <RecapMovementsTable movements={filteredMovements} />
          </div>
        </>
      )}
    </div>
  )
}
