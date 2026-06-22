import { useMemo, useState } from 'react'
import { format, startOfDay, subDays } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useProducts } from '@/features/products/hooks/useProducts'
import { useStock } from '@/features/stock/hooks/useStock'
import { useMovements } from '@/features/movements/hooks/useMovements'
import { RecapStats } from '../components/RecapStats'
import { RecapChart } from '../components/RecapChart'
import { LowStockTable } from '../components/LowStockTable'
import { ExportActions } from '../components/ExportActions'
import { MovementList } from '@/features/movements/components/MovementList'
import { Button } from '@/components/ui/button'

type Period = '7' | '14' | '30' | 'all'

export default function RecapPage() {
  const currency = 'XOF'
  const [period, setPeriod] = useState<Period>('14')

  const { data: products, isLoading: productsLoading } = useProducts()
  const { data: stock, isLoading: stockLoading } = useStock()
  const { data: movements, isLoading: movementsLoading } = useMovements()

  const isLoading = productsLoading || stockLoading || movementsLoading

  const activeProducts = useMemo(() => products?.filter((p) => p.isActive) ?? [], [products])
  const stockItems = useMemo(() => stock ?? [], [stock])
  const allMovements = useMemo(() => movements ?? [], [movements])

  const periodDays = period === 'all' ? Infinity : Number(period)
  const cutoffDate =
    periodDays === Infinity ? null : startOfDay(subDays(new Date(), periodDays - 1))

  const filteredMovements = useMemo(() => {
    if (!cutoffDate) return allMovements
    return allMovements.filter((m) => startOfDay(new Date(m.createdAt)) >= cutoffDate)
  }, [allMovements, cutoffDate])

  const lowStockItems = useMemo(
    () => stockItems.filter((item) => item.quantity === 0 || item.quantity <= item.threshold),
    [stockItems]
  )

  const totalQuantity = useMemo(
    () => stockItems.reduce((sum, item) => sum + item.quantity, 0),
    [stockItems]
  )

  const stockValue = useMemo(() => {
    const productMap = new Map(products?.map((p) => [p.id, p]) ?? [])
    return stockItems.reduce((sum, item) => {
      const product = productMap.get(item.productId)
      return sum + item.quantity * (product?.costPrice ?? 0)
    }, 0)
  }, [stockItems, products])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Récapitulatif</h1>
          <p className="text-muted-foreground">Statistiques et rapports par période.</p>
        </div>
        <ExportActions
          products={activeProducts}
          stock={stockItems}
          movements={allMovements}
          currency={currency}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(['7', '14', '30', 'all'] as Period[]).map((p) => (
          <Button
            key={p}
            variant={period === p ? 'default' : 'outline'}
            size="sm"
            onClick={() => setPeriod(p)}
          >
            {p === 'all' ? 'Tout' : `${p} jours`}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement du récapitulatif…</p>
      ) : (
        <>
          <RecapStats
            productCount={activeProducts.length}
            lowStockCount={lowStockItems.length}
            totalQuantity={totalQuantity}
            stockValue={stockValue}
            currency={currency}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <RecapChart
              movements={filteredMovements}
              days={periodDays === Infinity ? 30 : periodDays}
            />
            <LowStockTable items={lowStockItems} />
          </div>

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <h3 className="mb-4 text-sm font-medium text-muted-foreground">
              Derniers mouvements
              {cutoffDate && (
                <span className="ml-2 text-xs">
                  (depuis le {format(cutoffDate, 'dd/MM/yyyy', { locale: fr })})
                </span>
              )}
            </h3>
            <MovementList movements={filteredMovements.slice(0, 25)} />
          </div>
        </>
      )}
    </div>
  )
}
