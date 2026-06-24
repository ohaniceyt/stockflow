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
  const { data: stock, isPending, error, refetch } = useStock()
  const { session } = useAuth()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null)

  const orgName = session?.organization.name ?? 'StockFlow'

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
    await queryClient.invalidateQueries({ queryKey: ['stock'] })
    await refetch()
  }

  const handleExportPdf = () => {
    void exportStockToPdf(filteredStock, orgName)
  }

  const handleExportExcel = () => {
    void exportStockToExcel(filteredStock, orgName)
  }

  const handleShareWhatsApp = () => {
    shareStockOnWhatsApp(filteredStock, orgName)
  }

  return (
    <PullToRefresh onRefresh={handleRefresh} disabled={isPending}>
      <div className="space-y-4 pb-6">
        <StockHeader
          totalProducts={filteredStock.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={handleRefresh}
          onExportPdf={handleExportPdf}
          onExportExcel={handleExportExcel}
          onShareWhatsApp={handleShareWhatsApp}
          isRefreshing={isPending}
        />

        {error && (
          <p className="rounded-lg border border-[var(--rose)] bg-[var(--rose-light)] p-3 text-sm text-[var(--rose)]">
            {error.message}
          </p>
        )}

        {isPending ? (
          <p className="py-8 text-center text-sm text-[var(--text-faint)]">Chargement du stock…</p>
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
