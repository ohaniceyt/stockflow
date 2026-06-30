import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { Logo } from '@/features/marketing/components/Logo'
import { useAuth } from '@/features/auth/context/AuthContext'
import { cn } from '@/lib/utils'
import { navGroups } from './navConfig'

interface SidebarProps {
  onItemClick?: () => void
}

export function Sidebar({ onItemClick }: SidebarProps) {
  const { session, signOut, hasRole, isPlatformAdmin } = useAuth()

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

  const visibleGroups = navGroups.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        hasRole(item.roles) &&
        (!item.platformAdminOnly || isPlatformAdmin) &&
        featureEnabled(item.requiresFeature)
    ),
  }))

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-[240px] flex-col border-r bg-card md:flex">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <Logo variant="icon" className="h-9 w-9" />
        <div className="min-w-0">
          <p className="truncate font-semibold leading-tight">{org?.name ?? 'StockFlow'}</p>
          <p className="truncate text-sm text-muted-foreground">{session?.user.name}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto p-3">
        {visibleGroups.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.label} className="space-y-1">
                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      data-testid={`nav-${item.to.replace(/^\//, '').replace(/\//g, '-')}`}
                      onClick={onItemClick}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'border-l-[3px] border-primary bg-primary/10 text-primary'
                            : 'border-l-[3px] border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
                        )
                      }
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
        )}
      </nav>

      <div className="border-t p-3">
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
