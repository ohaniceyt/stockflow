import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { NavItem } from './navConfig'

interface MobileNavProps {
  navItems: NavItem[]
  onMenuOpen: () => void
}

export function MobileNav({ navItems, onMenuOpen }: MobileNavProps) {
  const { session, hasRole, isPlatformAdmin } = useAuth()
  const org = session?.organization

  const featureEnabled = (feature?: 'cashier' | 'storefront' | 'api') => {
    if (!feature) return true
    if (!org) return false
    switch (feature) {
      case 'cashier':
        return org.hasCashierEnabled
      case 'storefront':
        return org.hasStorefrontEnabled
      case 'api':
        return org.hasApiEnabled
      default:
        return false
    }
  }

  const visibleItems = navItems.filter(
    (item) =>
      hasRole(item.roles) &&
      (!item.platformAdminOnly || isPlatformAdmin) &&
      featureEnabled(item.requiresFeature)
  )
  const primaryItems = visibleItems.filter((item) => item.primary)

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden safe-area-pb"
      aria-label="Navigation mobile"
    >
      {primaryItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('h-5 w-5', isActive && 'fill-current')} />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onMenuOpen}
        className="flex min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors active:text-foreground"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-5 w-5" />
        <span>Plus</span>
      </button>
    </nav>
  )
}
