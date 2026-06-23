import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { useLocations } from '@/features/locations/hooks/useLocations'
import type { StockItem } from '../services/stockService'

interface QuickMovementDialogProps {
  item: StockItem | null
  type: 'IN' | 'OUT' | 'TRANSFER' | null
  onClose: () => void
  onConfirm: (
    item: StockItem,
    type: 'IN' | 'OUT' | 'TRANSFER',
    quantity: number,
    targetLocationId?: string
  ) => void
  isLoading?: boolean
}

const typeTitles: Record<'IN' | 'OUT' | 'TRANSFER', string> = {
  IN: 'Entrée en stock',
  OUT: 'Sortie de stock',
  TRANSFER: 'Transfert de stock',
}

export function QuickMovementDialog({
  item,
  type,
  onClose,
  onConfirm,
  isLoading,
}: QuickMovementDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const [targetLocationId, setTargetLocationId] = useState('')
  const { data: locations } = useLocations()
  const open = Boolean(item && type)
  const isTransfer = type === 'TRANSFER'

  const handleClose = () => {
    onClose()
    setQuantity(1)
    setTargetLocationId('')
  }

  const handleConfirm = () => {
    if (!item || !type) return
    if (isTransfer && !targetLocationId) return
    onConfirm(item, type, quantity, isTransfer ? targetLocationId : undefined)
  }

  const targetOptions = (locations ?? []).filter((l) => l.id !== item?.locationId)

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type ? typeTitles[type] : 'Mouvement'}</DialogTitle>
          <DialogDescription>
            {item?.productName} — {item?.locationName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantité</Label>
            <Input
              id="quantity"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            />
          </div>

          {isTransfer && (
            <div className="space-y-2">
              <Label htmlFor="target-location">Emplacement de destination</Label>
              <Select
                id="target-location"
                value={targetLocationId}
                onChange={(e) => setTargetLocationId(e.target.value)}
              >
                <option value="">Sélectionner un emplacement</option>
                {targetOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={Boolean(isLoading) || (isTransfer && !targetLocationId)}
          >
            {isLoading ? 'Enregistrement…' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
