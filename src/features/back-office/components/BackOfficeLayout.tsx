import { NavLink, Outlet } from 'react-router-dom'
import { ArrowLeft, BarChart3, Building2, FileText, LogOut, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/context/AuthContext'
import { cn } from '@/lib/utils'
import { SudoBanner } from './SudoBanner'

const navItems = [
  { to: '/back-office', label: "Vue d'ensemble", icon: BarChart3 },
  { to: '/back-office/organizations', label: 'Organisations', icon: Building2 },
  { to: '/back-office/users', label: 'Utilisateurs', icon: Users },
  { to: '/back-office/audit-logs', label: 'Audit', icon: FileText },
]

export default function BackOfficeLayout() {
  const { session, signOut, platformAdminRole, isPlatformAdmin } = useAuth()

  if (!isPlatformAdmin) {
    return null
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground">
            B
          </div>
          <div>
            <p className="font-bold leading-tight">Back Office</p>
            <p className="text-sm text-muted-foreground">{session?.user.email}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/back-office'}
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

        <div className="border-t p-3 space-y-1">
          <NavLink
            to="/dashboard"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à l\'app
          </NavLink>
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

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <h2 className="text-base font-semibold md:text-lg">StockFlow Back Office</h2>
          <div className="text-sm text-muted-foreground">
            {platformAdminRole === 'super_admin' ? 'Super Admin' : 'Modérateur'}
          </div>
        </header>

        <div className="p-4 md:p-6 space-y-4">
          <SudoBanner />
          <Outlet />
        </div>
      </main>
    </div>
  )
}
