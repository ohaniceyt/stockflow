import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { contactSchema, type ContactFormData } from '../schemas/contactSchema'
import type { Contact, ContactType } from '@/types'

interface ContactFormProps {
  fixedType?: ContactType
  defaultValues?: Partial<Contact>
  onSubmit: (data: ContactFormData) => void
  onCancel: () => void
  isLoading?: boolean
  error?: Error | null
}

export function ContactForm({
  fixedType,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
  error,
}: ContactFormProps) {
  const [type, setType] = useState<ContactType>(fixedType ?? defaultValues?.type ?? 'SUPPLIER')
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [email, setEmail] = useState(defaultValues?.email ?? '')
  const [phone, setPhone] = useState(defaultValues?.phone ?? '')
  const [address, setAddress] = useState(defaultValues?.address ?? '')
  const [taxId, setTaxId] = useState(defaultValues?.taxId ?? '')
  const [notes, setNotes] = useState(defaultValues?.notes ?? '')
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true)
  const [errors, setErrors] = useState<Partial<Record<keyof ContactFormData, string>>>({})
  const disabled = Boolean(isLoading)

  const handleSubmit = (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    const result = contactSchema.safeParse({
      type,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      taxId: taxId.trim() || null,
      notes: notes.trim() || null,
      isActive,
    })
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ContactFormData, string>> = {}
      result.error.errors.forEach((err) => {
        const key = err.path[0] as keyof ContactFormData
        fieldErrors[key] ??= err.message
      })
      setErrors(fieldErrors)
      return
    }
    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      {!fixedType && (
        <div className="space-y-2">
          <Label htmlFor="contact-type">Type</Label>
          <Select
            id="contact-type"
            value={type}
            onChange={(e) => setType(e.target.value as ContactType)}
            disabled={disabled}
          >
            <option value="SUPPLIER">Fournisseur</option>
            <option value="CUSTOMER">Client</option>
          </Select>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="contact-name">Nom</Label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'SUPPLIER' ? 'Nom du fournisseur' : 'Nom du client'}
          disabled={disabled}
        />
        {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contact-email">Email</Label>
          <Input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@exemple.com"
            disabled={disabled}
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Téléphone</Label>
          <Input
            id="contact-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 XX XX XX XX"
            disabled={disabled}
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-address">Adresse</Label>
        <Input
          id="contact-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Abidjan, Côte d'Ivoire"
          disabled={disabled}
        />
        {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-tax-id">Identifiant fiscal / N° contribuable</Label>
        <Input
          id="contact-tax-id"
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          placeholder="CI123456789"
          disabled={disabled}
        />
        {errors.taxId && <p className="text-xs text-destructive">{errors.taxId}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-notes">Notes</Label>
        <Input
          id="contact-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations complémentaires"
          disabled={disabled}
        />
        {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-status">Statut</Label>
        <Select
          id="contact-status"
          value={isActive ? 'active' : 'inactive'}
          onChange={(e) => setIsActive(e.target.value === 'active')}
          disabled={disabled}
        >
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={disabled}>
          Annuler
        </Button>
        <Button type="submit" disabled={disabled}>
          {isLoading ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
    </form>
  )
}
