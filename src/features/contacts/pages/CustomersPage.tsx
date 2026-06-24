import { ContactsPage } from './ContactsPage'

export default function CustomersPage() {
  return (
    <ContactsPage
      type="CUSTOMER"
      title="Clients"
      subtitle="Gérez les clients associés à vos sorties de stock."
      buttonLabel="Nouveau client"
    />
  )
}
