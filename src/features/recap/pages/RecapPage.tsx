import { useMemo, useState } from 'react'
import { format, startOfDay, subDays, isAfter, isBefore } from 'date-fns'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { useAuth } from '@/features/auth/context/AuthContext'
import { RecapStats } from '../components/RecapStats'
import { RecapChart } from '../components/RecapChart'
import { ProductBalanceTable } from '../components/ProductBalanceTable'
import { RecapMovementsTable } from '../components/RecapMovementsTable'
import { ExportActions } from '../components/ExportActions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

type PeriodMode = 'today' | 'week' | 'month' | 'custom'

export default function RecapPage() {
  const currency = 'XOF'
  const { session } = useAuth()
  const orgName = session?.membership.orgId ? 'StockFlow' : 'StockFlow'

  const [periodMode, setPeriodMode] = useState<PeriodMode>('week')
  const [startDate, setStartDate] = useState<string>(() =>
    format(subDays(new Date(), 6), 'yyyy-MM-dd')
  )
  const [endDate, setEndDate] = useState<string>(() => format(new Date(), 'yyyy-MM-dd'))
  const [dateError, setDateError] = useState<string | null>(null)

  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: stock, isLoading: stockLoading } = useStock()
  const { data: movements, isLoading: movementsLoading } = useMovements()

  const isLoading = productsLoading || stockLoading || movementsLoading

  const activeProducts = useMemo(() => products?.filter((p) => p.isActive) ?? [], [products])
  const stockItems = useMemo(() => stock ?? [], [stock])
  const allMovements = useMemo(() => movements ?? [], [movements])

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
        const start = startDate ? startOfDay(new Date(startDate)) : today
        const end = endDate ? startOfDay(new Date(endDate)) : today
        return {
          start,
          end,
          label: `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`,
        }
      }
    }
  }, [periodMode, startDate, endDate])

  const filteredMovements = useMemo(() => {
    return allMovements.filter((m) => {
      const mDate = startOfDay(new Date(m.createdAt))
      return (
        (isAfter(mDate, periodRange.start) || mDate.getTime() === periodRange.start.getTime()) &&
        (isBefore(mDate, periodRange.end) || mDate.getTime() === periodRange.end.getTime())
      )
    })
  }, [allMovements, periodRange])

  const totalQuantity = useMemo(
    () => stockItems.reduce((sum, item) => sum + item.quantity, 0),
    [stockItems]
  )

  const productMap = useMemo(() => new Map(products?.map((p) => [p.id, p]) ?? []), [products])

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

  const revenue = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'OUT')
      .reduce((sum, m) => {
        const product = productMap.get(m.productId)
        return sum + m.quantity * (product?.sellingPrice ?? 0)
      }, 0)
  }, [filteredMovements, productMap])

  const generatedMargin = useMemo(() => {
    return filteredMovements
      .filter((m) => m.type === 'OUT')
      .reduce((sum, m) => {
        const product = productMap.get(m.productId)
        if (!product) return sum
        return sum + m.quantity * (product.sellingPrice - product.costPrice)
      }, 0)
  }, [filteredMovements, productMap])

  const handleStartChange = (value: string) => {
    setStartDate(value)
    if (endDate && value && isAfter(startOfDay(new Date(value)), startOfDay(new Date(endDate)))) {
      setDateError('La date de début doit être antérieure à la date de fin.')
    } else {
      setDateError(null)
    }
  }

  const handleEndChange = (value: string) => {
    setEndDate(value)
    if (
      startDate &&
      value &&
      isAfter(startOfDay(new Date(startDate)), startOfDay(new Date(value)))
    ) {
      setDateError('La date de début doit être antérieure à la date de fin.')
    } else {
      setDateError(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Récapitulatif</h1>
          <p className="text-muted-foreground">Synthèse périodique des mouvements et du stock.</p>
        </div>
        <ExportActions
          periodLabel={periodRange.label}
          movements={filteredMovements}
          stock={stockItems}
          products={activeProducts}
          productMap={productMap}
          currency={currency}
          orgName={orgName}
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: 'today', label: "Aujourd'hui" },
              { key: 'week', label: 'Semaine' },
              { key: 'month', label: 'Mois' },
              { key: 'custom', label: 'Dates' },
            ] as { key: PeriodMode; label: string }[]
          ).map((p) => (
            <Button
              key={p.key}
              variant={periodMode === p.key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodMode(p.key)}
              className={periodMode === p.key ? 'page-on tab-on' : ''}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {periodMode === 'custom' && (
          <div className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-end">
            <div className="space-y-2 sm:flex-1">
              <Label htmlFor="recap-start">Du</Label>
              <Input
                id="recap-start"
                type="date"
                value={startDate}
                onChange={(e) => handleStartChange(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:flex-1">
              <Label htmlFor="recap-end">Au</Label>
              <Input
                id="recap-end"
                type="date"
                value={endDate}
                onChange={(e) => handleEndChange(e.target.value)}
              />
            </div>
            {dateError && <p className="text-sm text-destructive">{dateError}</p>}
          </div>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement du récapitulatif…</p>
      ) : (
        <>
          <RecapStats
            productCount={activeProducts.length}
            totalQuantity={totalQuantity}
            stockValue={stockValue}
            stockSellingValue={stockSellingValue}
            revenue={revenue}
            generatedMargin={generatedMargin}
            inCount={filteredMovements.filter((m) => m.type === 'IN').length}
            outCount={filteredMovements.filter((m) => m.type === 'OUT').length}
            currency={currency}
          />

          <RecapChart
            movements={filteredMovements}
            startDate={periodRange.start}
            endDate={periodRange.end}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <ProductBalanceTable movements={filteredMovements} products={activeProducts} />
            <RecapMovementsTable movements={filteredMovements} />
          </div>
        </>
      )}
    </div>
  )
}
