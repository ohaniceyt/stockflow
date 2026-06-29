import { NavLink } from 'react-router-dom'
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
  return (
    <div className="rounded-xl border bg-card p-1 shadow-sm">
      <nav
        className="flex gap-1 overflow-x-auto whitespace-nowrap"
        aria-label="Paramètres"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
