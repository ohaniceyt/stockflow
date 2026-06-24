import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import type { InventoryCountWithDetails, SessionWithDetails } from '../services/inventoryService'
import { ResponsiveTable, type ResponsiveColumn } from '@/components/ui/ResponsiveTable'

interface SessionDetailDialogProps {
  session: SessionWithDetails | null
  counts: InventoryCountWithDetails[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateCount: (countId: string, countedQuantity: number) => void
  onApply: () => void
  isLoading?: boolean
  error?: Error | null
}

const statusLabels: Record<string, string> = {
  pending: 'En cours',
  completed: 'Terminée',
  cancelled: 'Annulée',
}

export function SessionDetailDialog({
  session,
  counts,
  open,
  onOpenChange,
  onUpdateCount,
  onApply,
  isLoading,
  error,
}: SessionDetailDialogProps) {
  const [editingCountId, setEditingCountId] = useState<string | null>(null)
  const [draftQuantity, setDraftQuantity] = useState(0)

  const startEdit = (count: InventoryCountWithDetails) => {
    setEditingCountId(count.id)
    setDraftQuantity(count.countedQuantity)
  }

  const saveEdit = (countId: string) => {
    onUpdateCount(countId, draftQuantity)
    setEditingCountId(null)
  }

  if (!session) return null

  const actionColumn: ResponsiveColumn<InventoryCountWithDetails> | null =
    session.status === 'pending'
      ? {
          key: 'action',
          header: 'Action',
          className: 'text-right',
          cell: (count) =>
            editingCountId === count.id ? (
              <Button size="sm" onClick={() => saveEdit(count.id)} disabled={isLoading}>
                OK
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit(count)}
                disabled={isLoading}
              >
                Modifier
              </Button>
            ),
        }
      : null

  const columns: ResponsiveColumn<InventoryCountWithDetails>[] = [
    {
      key: 'product',
      header: 'Produit',
      cell: (count) => (
        <>
          {count.productName ?? '—'}
          <span className="ml-1 text-xs text-muted-foreground">
            ({count.productUnit ?? 'unité'})
          </span>
        </>
      ),
      className: 'font-medium',
    },
    {
      key: 'theoretical',
      header: 'Théorique',
      cell: (count) => count.theoreticalQuantity.toLocaleString(),
    },
    {
      key: 'counted',
      header: 'Compté',
      cell: (count) =>
        editingCountId === count.id ? (
          <Input
            type="number"
            min={0}
            className="w-24"
            value={draftQuantity}
            onChange={(e) => setDraftQuantity(Math.max(0, Number(e.target.value)))}
          />
        ) : (
          count.countedQuantity.toLocaleString()
        ),
    },
    {
      key: 'difference',
      header: 'Écart',
      cell: (count) => (
        <span
          className={
            count.difference !== 0
              ? count.difference > 0
                ? 'text-green-600'
                : 'text-destructive'
              : ''
          }
        >
          {count.difference > 0 ? '+' : ''}
          {count.difference.toLocaleString()}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Statut',
      cell: (count) =>
        count.isValidated ? (
          <Badge variant="default">Validé</Badge>
        ) : (
          <Badge variant="secondary">En attente</Badge>
        ),
    },
    ...(actionColumn ? [actionColumn] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{session.name}</DialogTitle>
          <DialogDescription>
            {session.locationName} — {statusLabels[session.status]} —{' '}
            {new Date(session.startedAt).toLocaleString('fr-FR')}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto py-4">
          <ResponsiveTable
            data={counts}
            columns={columns}
            keyExtractor={(count) => count.id}
            empty={
              <p className="text-center text-sm text-muted-foreground">
                Aucun produit dans cette session.
              </p>
            }
            mobileCardTitle={(count) => count.productName ?? 'Produit'}
          />
        </div>

        {session.status === 'pending' && (
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Fermer
            </Button>
            <Button onClick={onApply} disabled={isLoading}>
              {isLoading ? 'Application…' : 'Appliquer les ajustements'}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error.message}</p>}
      </DialogContent>
    </Dialog>
  )
}
