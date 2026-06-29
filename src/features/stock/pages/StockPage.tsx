import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/context/AuthContext'
import { useStock } from '../hooks/useStock'
import { StockHeader } from '../components/StockHeader'
import { StockGrid } from '../components/StockGrid'
import { StockDetailOverlay } from '../components/StockDetailOverlay'
import { PullToRefresh } from '../components/PullToRefresh'
import type { StockItem } from '../services/stockService'
import { exportStockToExcel, exportStockToPdf, shareStockOnWhatsApp } from '../utils/stockExport'

export default function StockPage() {
  const { data: stock, isPending, isFetching, error, refetch } = useStock()
  const { session, hasRole } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)

  const orgName = session?.organization.name ?? 'StockFlow'
  const orgId = session?.membership.orgId
  const canExport = hasRole(['super_admin', 'admin'])

  const filteredStock = useMemo(() => {
    if (!stock) return []
    if (!searchQuery.trim()) return stock
    const q = searchQuery.toLowerCase()
    return stock.filter(
      (item) =>
        item.productName.toLowerCase().includes(q) ||
        (item.category?.toLowerCase().includes(q) ?? false) ||
        (item.barcode?.toLowerCase().includes(q) ?? false) ||
        item.locationName.toLowerCase().includes(q)
    )
  }, [stock, searchQuery])

  const handleRefresh = async () => {
    if (orgId) {
      await queryClient.invalidateQueries({ queryKey: ['stock', orgId] })
    }
    await refetch()
  }

  const handleExportPdf = async () => {
    setExportError(null)
    try {
      await exportStockToPdf(filteredStock, orgName, { redactFinancials: !canExport })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Échec de l'export PDF")
    }
  }

  const handleExportExcel = async () => {
    setExportError(null)
    try {
      await exportStockToExcel(filteredStock, orgName, { redactFinancials: !canExport })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Échec de l'export Excel")
    }
  }

  const handleShareWhatsApp = () => {
    shareStockOnWhatsApp(filteredStock, orgName, { redactFinancials: !canExport })
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isFetching}>
      <div className="space-y-6 md:space-y-8">
        <StockHeader
          totalProducts={stock?.length ?? 0}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          onShareWhatsApp={handleShareWhatsApp}
          isRefreshing={isFetching}
          canExport={canExport}
        />

        {(error ?? exportError) && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error?.message ?? exportError}
          </p>
        )}

        {isPending ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-5 shadow-sm">
                <span className="absolute left-0 right-0 top-0 h-1 bg-border" />
                <div className="mb-3 h-1 w-full animate-pulse rounded-full bg-muted" />
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="space-y-2">
                    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-5 w-14 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="mb-2 h-7 w-16 animate-pulse rounded bg-muted" />
                <div className="mt-auto space-y-2">
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <StockGrid
            stock={filteredStock}
            searchQuery={searchQuery}
            onItemClick={setSelectedItem}
          />
        )}

        <StockDetailOverlay item={selectedItem} onClose={() => setSelectedItem(null)} />
      </div>
    </PullToRefresh>
  )
}
