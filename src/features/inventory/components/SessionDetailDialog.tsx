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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { InventoryCountWithDetails, SessionWithDetails } from '../services/inventoryService'

interface SessionDetailDialogProps {
  session: SessionWithDetails | null
  counts: InventoryCountWithDetails[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateCount: (countId: string, countedQuantity: number) => void
  onApply: () => void
  isLoading?: boolean
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Théorique</TableHead>
                <TableHead>Compté</TableHead>
                <TableHead>Écart</TableHead>
                <TableHead>Statut</TableHead>
                {session.status === 'pending' && (
                  <TableHead className="text-right">Action</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {counts.map((count) => (
                <TableRow key={count.id}>
                  <TableCell className="font-medium">
                    {count.productName ?? '—'}
                    <span className="ml-1 text-xs text-muted-foreground">
                      ({count.productUnit ?? 'unité'})
                    </span>
                  </TableCell>
                  <TableCell>{count.theoreticalQuantity.toLocaleString()}</TableCell>
                  <TableCell>
                    {editingCountId === count.id ? (
                      <Input
                        type="number"
                        min={0}
                        className="w-24"
                        value={draftQuantity}
                        onChange={(e) => setDraftQuantity(Math.max(0, Number(e.target.value)))}
                      />
                    ) : (
                      count.countedQuantity.toLocaleString()
                    )}
                  </TableCell>
                  <TableCell
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
                  </TableCell>
                  <TableCell>
                    {count.isValidated ? (
                      <Badge variant="default">Validé</Badge>
                    ) : (
                      <Badge variant="secondary">En attente</Badge>
                    )}
                  </TableCell>
                  {session.status === 'pending' && (
                    <TableCell className="text-right">
                      {editingCountId === count.id ? (
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
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
      </DialogContent>
    </Dialog>
  )
}
