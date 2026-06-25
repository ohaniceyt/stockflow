import { Button } from '@/components/ui/button'
import { Mail, MapPin, Phone } from 'lucide-react'
import type { Contact, UserRole } from '@/types'

interface ContactListProps {
  contacts: Contact[]
  currentUserRole: UserRole
  onEdit: (contact: Contact) => void
  onToggleActive: (contact: Contact) => void
  isUpdating: boolean
}

export function ContactList({
  contacts,
  currentUserRole,
  onEdit,
  onToggleActive,
  isUpdating,
}: ContactListProps) {
  const canManage = ['super_admin', 'admin'].includes(currentUserRole)

  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Aucun contact. Créez-en un pour commencer.</p>
    )
  }

  return (
    <div className="space-y-2">
      {contacts.map((contact) => (
        <div
          key={contact.id}
          className="flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-semibold">{contact.name}</p>
              {contact.isActive ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  Actif
                </span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  Inactif
                </span>
              )}
            </div>
            {contact.taxId && (
              <p className="text-sm text-muted-foreground">N° fiscal : {contact.taxId}</p>
            )}
            {contact.email && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Mail className="h-3.5 w-3.5" /> {contact.email}
              </p>
            )}
            {contact.phone && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {contact.phone}
              </p>
            )}
            {contact.address && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" /> {contact.address}
              </p>
            )}
            {contact.notes && <p className="text-sm text-muted-foreground">{contact.notes}</p>}
          </div>

          {canManage && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-shrink-0">
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                size="sm"
                onClick={() => onToggleActive(contact)}
                disabled={isUpdating}
              >
                {contact.isActive ? 'Désactiver' : 'Activer'}
              </Button>
              <Button
                className="w-full sm:w-auto"
                variant="outline"
                size="sm"
                onClick={() => onEdit(contact)}
                disabled={isUpdating}
              >
                Modifier
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
