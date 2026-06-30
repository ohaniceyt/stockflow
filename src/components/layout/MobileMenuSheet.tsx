import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { Logo } from '@/features/marketing/components/Logo'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context/AuthContext'
import { navGroups } from './navConfig'

interface MobileMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileMenuSheet({ open, onOpenChange }: MobileMenuSheetProps) {
  const { session, signOut, hasRole, isPlatformAdmin } = useAuth()
  const location = useLocation()
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

  useEffect(() => {
    onOpenChange(false)
  }, [location.pathname, onOpenChange])

  if (!open) return null

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
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div className="absolute bottom-0 left-0 top-0 w-[85%] max-w-xs border-r bg-card p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo variant="icon" className="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate font-bold leading-tight">{org?.name ?? 'StockFlow'}</p>
              <p className="truncate text-sm text-muted-foreground">{session?.user.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Fermer le menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto pb-4">
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
                        end={item.to === '/'}
                        onClick={() => onOpenChange(false)}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
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

        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              void signOut()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}
