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
      <div className="space-y-4 pb-6">
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
          <p className="rounded-lg border border-[var(--rose)] bg-[var(--rose-light)] p-3 text-sm text-[var(--rose)]">
            {error?.message ?? exportError}
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
