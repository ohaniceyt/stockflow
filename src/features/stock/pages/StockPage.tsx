import { useState } from 'react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { StockList } from '../components/StockList'
import { QuickMovementDialog } from '../components/QuickMovementDialog'
import { useRecordMovement, useStock } from '../hooks/useStock'
import type { StockItem } from '../services/stockService'

export default function StockPage() {
  const { data: stock, isLoading, error } = useStock()
  const record = useRecordMovement()
  const { hasRole } = useAuth()
  const canEdit = hasRole(['super_admin', 'admin', 'operator'])

  const [dialogState, setDialogState] = useState<{
    item: StockItem | null
    type: 'IN' | 'OUT' | null
  }>({ item: null, type: null })

  const handleQuickMove = (item: StockItem, type: 'IN' | 'OUT') => {
    setDialogState({ item, type })
  }

  const handleConfirm = (item: StockItem, type: 'IN' | 'OUT', quantity: number) => {
    record.mutate(
      {
        productId: item.productId,
        locationId: item.locationId,
        type,
        quantity,
      },
      {
        onSuccess: () => {
          setDialogState({ item: null, type: null })
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Stock</h1>
        <p className="text-muted-foreground">Visualisation des niveaux de stock par emplacement.</p>
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement du stock…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {!isLoading && !error && stock && (
        <StockList
          stock={stock}
          canEdit={canEdit}
          onQuickMove={handleQuickMove}
          isUpdating={record.isPending}
        />
      )}

      <QuickMovementDialog
        item={dialogState.item}
        type={dialogState.type}
        onClose={() => setDialogState({ item: null, type: null })}
        onConfirm={handleConfirm}
        isLoading={record.isPending}
      />
    </div>
  )
}
