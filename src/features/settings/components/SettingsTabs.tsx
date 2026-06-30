import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/settings/profile', label: 'Profil' },
  { to: '/settings/organization', label: 'Organisation' },
  { to: '/settings/team', label: 'Équipe' },
  { to: '/settings/api', label: 'API' },
  { to: '/settings/subscription', label: 'Abonnement' },
  { to: '/settings/storefront', label: 'Store' },
]

export function SettingsTabs() {
  const { pathname } = useLocation()

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-6 border-y bg-background px-4 py-2 sm:mx-0 sm:rounded-xl sm:border">
      <nav
        className="flex gap-1 overflow-x-auto whitespace-nowrap pb-1 scrollbar-hide"
        aria-label="Paramètres"
      >
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.to)
          return (
            <NavLink
              key={tab.to}
              to={tab.to}
              aria-current={isActive ? 'page' : undefined}
              className={({ isActive: linkActive }) =>
                cn(
                  'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  linkActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              {tab.label}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
