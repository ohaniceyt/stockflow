import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { LocationFormData } from '../schemas/locationSchema'

interface LocationFormProps {
  defaultValues?: Partial<LocationFormData>
  onSubmit: (data: LocationFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

export function LocationForm({ defaultValues, onSubmit, onCancel, isLoading }: LocationFormProps) {
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [description, setDescription] = useState(defaultValues?.description ?? '')
  const [address, setAddress] = useState(defaultValues?.address ?? '')
  const [errors, setErrors] = useState<Partial<Record<'name', string>>>({})

  const validate = () => {
    const next: Partial<Record<'name', string>> = {}
    if (!name.trim()) next.name = 'Le nom est requis'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!validate()) return
    onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      address: address.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="location-name">Nom</Label>
        <Input
          id="location-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Entrepôt principal"
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-description">Description</Label>
        <Input
          id="location-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Zone de stockage principale"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-address">Adresse</Label>
        <Input
          id="location-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Abidjan, Côte d'Ivoire"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Annuler
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}
