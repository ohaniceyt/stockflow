import { useState } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { OfflineStatus } from '@/features/offline/components/OfflineStatus'
import { SudoBanner } from '@/features/back-office/components/SudoBanner'
import { cn } from '@/lib/utils'
import { navItems } from './navConfig'
import { MobileNav } from './MobileNav'
import { MobileMenuSheet } from './MobileMenuSheet'

export function AppLayout() {
  const { session, signOut, hasRole, isPlatformAdmin } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

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

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            S
          </div>
          <div>
            <p className="font-bold leading-tight">StockFlow</p>
            <p className="text-xs text-muted-foreground">{session?.user.name}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems
            .filter(
              (item) =>
                hasRole(item.roles) &&
                (!item.platformAdminOnly || isPlatformAdmin) &&
                featureEnabled(item.requiresFeature)
            )
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={`nav-${item.to.replace(/^\//, '').replace(/\//g, '-')}`}
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

        <div className="border-t p-3">
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto md:pl-64">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground md:hidden"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <h2 className="text-base font-semibold md:text-lg">StockFlow vNext</h2>

          <div className="text-sm text-muted-foreground">
            {session?.membership.role === 'super_admin' ? 'Super Admin' : session?.user.name}
          </div>
        </header>

        <div className="p-4 pb-24 md:p-6 md:pb-6">
          <SudoBanner />
          <Outlet />
        </div>
      </main>

      <MobileMenuSheet open={menuOpen} onOpenChange={setMenuOpen} navItems={navItems} />
      <MobileNav navItems={navItems} onMenuOpen={() => setMenuOpen(true)} />
      <OfflineStatus className="bottom-20 md:bottom-4" />
    </div>
  )
}
