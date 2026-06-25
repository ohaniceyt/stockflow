import type { UserRole } from '@/types'

export const USER_ROLES: readonly UserRole[] = [
  'super_admin',
  'admin',
  'operator',
  'cashier',
  'reader',
]

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super administrateur',
  admin: 'Administrateur',
  operator: 'Opérateur',
  cashier: 'Caissier/Caissière',
  reader: 'Lecteur',
}
