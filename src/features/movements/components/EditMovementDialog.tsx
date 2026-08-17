import { useMemo, useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { Contact } from '@/types'
import { editMovementSchema } from '../schemas/editMovementSchema'
import { useUpdateMovement } from '../hooks/useMovements'
import type { MovementWithDetails } from '../services/movementService'

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const typeLabels: Record<string, string> = {
  IN: 'Entrée',
  OUT: 'Sortie',
  TRANSFER: 'Transfert',
  INVENTORY: 'Inventaire',
  ADJUSTMENT: 'Ajustement',
}

const typeVariants: Record<string, BadgeVariant> = {
  IN: 'default',
  OUT: 'secondary',
  TRANSFER: 'outline',
  INVENTORY: 'outline',
  ADJUSTMENT: 'outline',
}

interface EditMovementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement: MovementWithDetails | null
  contacts: Contact[]
}

export function EditMovementDialog({
  open,
  onOpenChange,
  movement,
  contacts,
}: EditMovementDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Modifier le mouvement</DialogTitle>
          <DialogDescription>
            Seuls le motif et le contact sont modifiables. La quantité et le stock ne changent pas.
          </DialogDescription>
        </DialogHeader>
        {movement && (
          <EditMovementForm
            key={movement.id}
            movement={movement}
            contacts={contacts}
            onOpenChange={onOpenChange}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface EditMovementFormProps {
  movement: MovementWithDetails
  contacts: Contact[]
  onOpenChange: (open: boolean) => void
}

// Monté frais à chaque ouverture (keyed par movement.id dans le parent) : les
// useState initialiseurs lisent les valeurs courantes du mouvement sans effet.
function EditMovementForm({ movement, contacts, onOpenChange }: EditMovementFormProps) {
  const update = useUpdateMovement()
  const [reason, setReason] = useState(() => movement.reason ?? '')
  const [contactId, setContactId] = useState(() => movement.contactId ?? '')
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})

  // Contacts proposés, filtrés par type de mouvement (IN -> fournisseur,
  // OUT -> client, autres -> tous les actifs). On inclut toujours le contact
  // actuellement rattaché (même inactif ou hors filtre) pour qu'il reste
  // visible et sélectionnable.
  const filteredContacts = useMemo(() => {
    const contactType =
      movement.type === 'IN' ? 'SUPPLIER' : movement.type === 'OUT' ? 'CUSTOMER' : null
    const base = contactType
      ? contacts.filter((c) => c.type === contactType && c.isActive)
      : contacts.filter((c) => c.isActive)
    const current = movement.contactId
      ? contacts.find((c) => c.id === movement.contactId)
      : undefined
    if (current && !base.some((c) => c.id === current.id)) {
      return [current, ...base]
    }
    return base
  }, [movement, contacts])

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    const trimmedReason = reason.trim() || null
    const patch = { reason: trimmedReason, contactId: contactId || null }

    const parsed = editMovementSchema.safeParse(patch)
    if (!parsed.success) {
      const fieldErrors: Partial<Record<string, string>> = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (typeof key === 'string' && !fieldErrors[key]) {
          fieldErrors[key] = issue.message
        }
      }
      setErrors(fieldErrors)
      return
    }

    update.mutate(
      { movementId: movement.id, patch },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  const contactLabel =
    movement.type === 'IN' ? 'Fournisseur' : movement.type === 'OUT' ? 'Client' : 'Contact'

  return (
    <>
      <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={typeVariants[movement.type] ?? 'outline'}>
            {typeLabels[movement.type] ?? movement.type}
          </Badge>
          <span className="font-medium">{movement.productName ?? '—'}</span>
          <span className="text-muted-foreground">× {movement.quantity}</span>
        </div>
        <p className="mt-1 text-muted-foreground">
          {movement.locationName ?? '—'}
          {movement.targetLocationName ? ` → ${movement.targetLocationName}` : ''}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-contact">{contactLabel}</Label>
          <Select
            id="edit-contact"
            value={contactId}
            onChange={(e) => setContactId(e.target.value)}
          >
            <option value="">Aucun (optionnel)</option>
            {filteredContacts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? ' (inactif)' : ''}
              </option>
            ))}
          </Select>
          {errors.contactId && <p className="text-sm text-destructive">{errors.contactId}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-reason">Motif</Label>
          <Textarea
            id="edit-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: livraison client, réapprovisionnement…"
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground">{reason.length}/500</p>
          {errors.reason && <p className="text-sm text-destructive">{errors.reason}</p>}
        </div>

        {update.error && <p className="text-sm text-destructive">{update.error.message}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={update.isPending}
          >
            Annuler
          </Button>
          <Button type="submit" disabled={update.isPending}>
            {update.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </form>
    </>
  )
}
