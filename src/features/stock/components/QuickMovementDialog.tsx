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
import type { StockItem } from '../services/stockService'

interface QuickMovementDialogProps {
  item: StockItem | null
  type: 'IN' | 'OUT' | null
  onClose: () => void
  onConfirm: (item: StockItem, type: 'IN' | 'OUT', quantity: number) => void
  isLoading?: boolean
}

export function QuickMovementDialog({
  item,
  type,
  onClose,
  onConfirm,
  isLoading,
}: QuickMovementDialogProps) {
  const [quantity, setQuantity] = useState(1)
  const open = Boolean(item && type)

  const handleClose = () => {
    onClose()
    setQuantity(1)
  }

  const handleConfirm = () => {
    if (!item || !type) return
    onConfirm(item, type, quantity)
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === 'IN' ? 'Entrée en stock' : 'Sortie de stock'}</DialogTitle>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Annuler
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? 'Enregistrement…' : 'Confirmer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
