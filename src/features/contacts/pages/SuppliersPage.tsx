import { ContactsPage } from './ContactsPage'

export default function SuppliersPage() {
  return (
    <ContactsPage
      type="SUPPLIER"
      title="Fournisseurs"
      subtitle="Gérez les fournisseurs associés à vos entrées de stock."
      buttonLabel="Nouveau fournisseur"
    />
  )
}
