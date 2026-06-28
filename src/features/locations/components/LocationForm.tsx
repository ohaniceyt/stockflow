import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { locationSchema, type LocationFormData } from '../schemas/locationSchema'

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
  const [errors, setErrors] = useState<Partial<Record<keyof LocationFormData, string>>>({})

  const validate = (): boolean => {
    const result = locationSchema.safeParse({
      name,
      description: description.trim() || null,
      address: address.trim() || null,
    })
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof LocationFormData, string>> = {}
      result.error.errors.forEach((e) => {
        const key = e.path[0] as keyof LocationFormData
        fieldErrors[key] = e.message
      })
      setErrors(fieldErrors)
      return false
    }
    setErrors({})
    return true
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
          disabled={isLoading}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-description">Description</Label>
        <Textarea
          id="location-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Zone de stockage principale"
          disabled={isLoading}
        />
        {errors.description && <p className="text-xs text-destructive">{errors.description}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="location-address">Adresse</Label>
        <Textarea
          id="location-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Abidjan, Côte d'Ivoire"
          disabled={isLoading}
        />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
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
