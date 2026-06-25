import type { UserRole } from '@/types'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ClipboardList,
  Warehouse,
  MapPin,
  Users,
  FileText,
  CreditCard,
  Shield,
  Truck,
  UserCheck,
  Building2,
  UserCircle,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
  primary?: boolean
  platformAdminOnly?: boolean
}

export const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
    primary: true,
  },
  {
    to: '/stock',
    label: 'Stock',
    icon: Package,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
    primary: true,
  },
  {
    to: '/movements',
    label: 'Mouvements',
    icon: ArrowLeftRight,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
    primary: true,
  },
  {
    to: '/inventory',
    label: 'Inventaire',
    icon: ClipboardList,
    roles: ['super_admin', 'admin', 'operator'],
    primary: true,
  },
  { to: '/products', label: 'Produits', icon: Warehouse, roles: ['super_admin', 'admin'] },
  { to: '/locations', label: 'Emplacements', icon: MapPin, roles: ['super_admin', 'admin'] },
  { to: '/suppliers', label: 'Fournisseurs', icon: Truck, roles: ['super_admin', 'admin'] },
  { to: '/customers', label: 'Clients', icon: UserCheck, roles: ['super_admin', 'admin'] },
  { to: '/team', label: 'Équipe', icon: Users, roles: ['super_admin', 'admin'] },
  {
    to: '/recap',
    label: 'Récap',
    icon: FileText,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
  },
  {
    to: '/settings/profile',
    label: 'Profil',
    icon: UserCircle,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
  },
  {
    to: '/settings/organization',
    label: 'Organisation',
    icon: Building2,
    roles: ['super_admin', 'admin'],
  },
  {
    to: '/settings/subscription',
    label: 'Abonnement',
    icon: CreditCard,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
  },
  {
    to: '/back-office',
    label: 'Back Office',
    icon: Shield,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
    platformAdminOnly: true,
  },
]
