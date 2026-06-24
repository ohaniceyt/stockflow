import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth/context/AuthContext'
import { ContactForm } from '../components/ContactForm'
import { ContactList } from '../components/ContactList'
import { useContacts, useCreateContact, useUpdateContact } from '../hooks/useContacts'
import type { Contact, ContactType } from '@/types'
import type { ContactFormData } from '../schemas/contactSchema'

interface ContactsPageProps {
  type: ContactType
  title: string
  subtitle: string
  buttonLabel: string
}

export function ContactsPage({ type, title, subtitle, buttonLabel }: ContactsPageProps) {
  const { session, hasRole } = useAuth()
  const { data: contacts, isLoading, error } = useContacts(type)
  const create = useCreateContact()
  const update = useUpdateContact()

  const canManage = hasRole(['super_admin', 'admin'])

  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)

  const handleCreate = (data: ContactFormData) => {
    create.mutate(data, {
      onSuccess: () => {
        setIsDialogOpen(false)
      },
    })
  }

  const handleUpdate = (data: ContactFormData) => {
    if (!editingContact) return
    update.mutate(
      { id: editingContact.id, ...data },
      {
        onSuccess: () => {
          setEditingContact(null)
        },
      }
    )
  }

  const handleToggleActive = (contact: Contact) => {
    update.mutate({ id: contact.id, isActive: !contact.isActive })
  }

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact)
  }

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open)
    if (!open) {
      setEditingContact(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        {canManage && (
          <Button className="w-full sm:w-auto" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {buttonLabel}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-muted-foreground">Chargement…</p>}
      {error && <p className="text-destructive">{error.message}</p>}
      {!isLoading && !error && contacts && (
        <ContactList
          contacts={contacts}
          currentUserRole={session?.membership.role ?? 'operator'}
          onEdit={handleEdit}
          onToggleActive={handleToggleActive}
          isUpdating={create.isPending || update.isPending}
        />
      )}

      <Dialog open={isDialogOpen || Boolean(editingContact)} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingContact ? 'Modifier' : 'Nouveau'} {title.toLowerCase()}
            </DialogTitle>
            <DialogDescription>
              {editingContact
                ? 'Mettez à jour les informations de ce contact.'
                : `Créez un nouveau ${type === 'SUPPLIER' ? 'fournisseur' : 'client'}.`}
            </DialogDescription>
          </DialogHeader>
          <ContactForm
            fixedType={type}
            defaultValues={editingContact ?? undefined}
            onSubmit={editingContact ? handleUpdate : handleCreate}
            onCancel={() => handleOpenChange(false)}
            isLoading={create.isPending || update.isPending}
          />
          {(create.error ?? update.error) && (
            <p className="text-sm text-destructive">{(create.error ?? update.error)?.message}</p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
