import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LogOut, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/features/auth/context/AuthContext'
import type { NavItem } from './navConfig'

interface MobileMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  navItems: NavItem[]
}

export function MobileMenuSheet({ open, onOpenChange, navItems }: MobileMenuSheetProps) {
  const { session, logout, hasRole } = useAuth()
  const location = useLocation()

  useEffect(() => {
    onOpenChange(false)
  }, [location.pathname, onOpenChange])

  if (!open) return null

  const visibleItems = navItems.filter((item) => hasRole(item.roles))

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      <div className="absolute left-0 top-0 bottom-0 w-[80%] max-w-xs border-r bg-card p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
              S
            </div>
            <div>
              <p className="font-bold leading-tight">StockFlow</p>
              <p className="text-xs text-muted-foreground">{session?.user.name}</p>
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

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => (
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
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t pt-3">
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
              logout()
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </div>
    </div>
  )
}
