import type { UserRole } from '@/types'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ClipboardList,
  Warehouse,
  MapPin,
  Users,
  Shield,
  Truck,
  UserCheck,
  Settings,
  Store,
  Receipt,
  LineChart,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: React.ElementType
  roles: UserRole[]
  primary?: boolean
  platformAdminOnly?: boolean
  requiresFeature?: 'cashier' | 'storefront' | 'api' | 'invoicing'
}

export const navItems: NavItem[] = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['super_admin', 'admin', 'operator', 'cashier', 'reader'],
    primary: true,
  },
  {
    to: '/stock',
    label: 'Stock',
    icon: Package,
    roles: ['super_admin', 'admin', 'operator', 'cashier', 'reader'],
    primary: true,
  },
  {
    to: '/analytics',
    label: 'Analytics',
    icon: LineChart,
    roles: ['super_admin', 'admin', 'operator', 'cashier', 'reader'],
    primary: true,
  },
  {
    to: '/movements',
    label: 'Mouvements',
    icon: ArrowLeftRight,
    roles: ['super_admin', 'admin', 'operator', 'cashier', 'reader'],
    primary: true,
  },
  {
    to: '/cashier',
    label: 'Caisse',
    icon: Store,
    roles: ['super_admin', 'admin', 'operator', 'cashier'],
    primary: true,
    requiresFeature: 'cashier',
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
    to: '/invoices',
    label: 'Facturation',
    icon: Receipt,
    roles: ['super_admin', 'admin', 'operator', 'reader'],
    requiresFeature: 'invoicing',
  },
  {
    to: '/settings/profile',
    label: 'Réglages',
    icon: Settings,
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
