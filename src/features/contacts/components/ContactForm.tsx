import { useState, type SyntheticEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import type { Contact, ContactType } from '@/types'
import type { ContactFormData } from '../schemas/contactSchema'

interface ContactFormProps {
  fixedType?: ContactType
  defaultValues?: Partial<Contact>
  onSubmit: (data: ContactFormData) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ContactForm({
  fixedType,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading,
}: ContactFormProps) {
  const [type, setType] = useState<ContactType>(fixedType ?? defaultValues?.type ?? 'SUPPLIER')
  const [name, setName] = useState(defaultValues?.name ?? '')
  const [email, setEmail] = useState(defaultValues?.email ?? '')
  const [phone, setPhone] = useState(defaultValues?.phone ?? '')
  const [address, setAddress] = useState(defaultValues?.address ?? '')
  const [taxId, setTaxId] = useState(defaultValues?.taxId ?? '')
  const [notes, setNotes] = useState(defaultValues?.notes ?? '')
  const [isActive, setIsActive] = useState(defaultValues?.isActive ?? true)
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
      type,
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      taxId: taxId.trim() || null,
      notes: notes.trim() || null,
      isActive,
    })
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
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contact-phone">Téléphone</Label>
          <Input
            id="contact-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+225 XX XX XX XX"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-address">Adresse</Label>
        <Input
          id="contact-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Abidjan, Côte d'Ivoire"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-tax-id">Identifiant fiscal / N° contribuable</Label>
        <Input
          id="contact-tax-id"
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          placeholder="CI123456789"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-notes">Notes</Label>
        <Input
          id="contact-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Informations complémentaires"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="contact-status">Statut</Label>
        <Select
          id="contact-status"
          value={isActive ? 'active' : 'inactive'}
          onChange={(e) => setIsActive(e.target.value === 'active')}
        >
          <option value="active">Actif</option>
          <option value="inactive">Inactif</option>
        </Select>
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
