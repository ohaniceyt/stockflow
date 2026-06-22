import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '@/features/auth/context/AuthContext'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/types'
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  ClipboardList,
  Warehouse,
  Users,
  FileText,
  LogOut,
  Building2,
} from 'lucide-react'

const navItems: { to: string; label: string; icon: React.ElementType; roles: UserRole[] }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'operator', 'reader'] },
  { to: '/stock', label: 'Stock', icon: Package, roles: ['super_admin', 'admin', 'operator', 'reader'] },
  { to: '/movements', label: 'Mouvements', icon: ArrowLeftRight, roles: ['super_admin', 'admin', 'operator', 'reader'] },
  { to: '/inventory', label: 'Inventaire', icon: ClipboardList, roles: ['super_admin', 'admin', 'operator'] },
  { to: '/products', label: 'Produits', icon: Warehouse, roles: ['super_admin', 'admin'] },
  { to: '/team', label: 'Équipe', icon: Users, roles: ['super_admin', 'admin'] },
  { to: '/recap', label: 'Récap', icon: FileText, roles: ['super_admin', 'admin', 'operator', 'reader'] },
  { to: '/super-admin', label: 'Super Admin', icon: Building2, roles: ['super_admin'] },
]

export function AppLayout() {
  const { session, logout, hasRole } = useAuth()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 flex-col border-r bg-card">
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
            .filter((item) => hasRole(item.roles))
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
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
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-6 backdrop-blur">
          <h2 className="text-lg font-semibold">StockFlow vNext</h2>
          <div className="text-sm text-muted-foreground">
            {session?.user.role === 'super_admin' ? 'Super Admin' : session?.user.name}
          </div>
        </header>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
