import { NavLink } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context/AuthContext'
import { navGroups } from './navConfig'

interface MobileNavProps {
  onMenuOpen: () => void
}

export function MobileNav({ onMenuOpen }: MobileNavProps) {
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

  const primaryItems = navGroups
    .flatMap((group) => group.items)
    .filter(
      (item) =>
        item.primary &&
        hasRole(item.roles) &&
        (!item.platformAdminOnly || isPlatformAdmin) &&
        featureEnabled(item.requiresFeature)
    )

  return (
    <nav
      className="safe-area-pb fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t bg-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Navigation mobile"
    >
      {primaryItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex min-h-[44px] min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className={cn('h-6 w-6', isActive && 'fill-current')} />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}

      <button
        type="button"
        onClick={onMenuOpen}
        className="flex min-h-[44px] min-w-[3.5rem] flex-col items-center justify-center gap-0.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors active:text-foreground"
        aria-label="Ouvrir le menu"
      >
        <Menu className="h-6 w-6" />
        <span>Plus</span>
      </button>
    </nav>
  )
}
