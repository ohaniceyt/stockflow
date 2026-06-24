import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Location } from '@/types'

interface CreateSessionDialogProps {
  locations: Location[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (input: { name: string; locationId: string }) => void
  isLoading?: boolean
  error?: Error | null
}

export function CreateSessionDialog({
  locations,
  open,
  onOpenChange,
  onSubmit,
  isLoading,
  error,
}: CreateSessionDialogProps) {
  const [name, setName] = useState('')
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '')
  const [errors, setErrors] = useState<Partial<Record<'name' | 'locationId', string>>>({})

  const validate = () => {
    const next: Partial<Record<'name' | 'locationId', string>> = {}
    if (!name.trim()) next.name = 'Le nom est requis'
    if (!locationId) next.locationId = 'Sélectionnez un emplacement'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({ name: name.trim(), locationId })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle session d'inventaire</DialogTitle>
          <DialogDescription>Créez une session pour un emplacement donné.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="session-name">Nom de la session</Label>
            <Input
              id="session-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Inventaire fin juin"
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-location">Emplacement</Label>
            <Select
              id="session-location"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
            >
              <option value="">Choisir un emplacement…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} {l.isDefault && '(défaut)'}
                </option>
              ))}
            </Select>
            {errors.locationId && <p className="text-xs text-destructive">{errors.locationId}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Création…' : 'Créer'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error.message}</p>}
        </form>
      </DialogContent>
    </Dialog>
  )
}
