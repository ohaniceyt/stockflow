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
    <div className="border-b">
      <nav
        className="flex gap-2 overflow-x-auto whitespace-nowrap px-1 pb-1 sm:gap-4"
        aria-label="Paramètres"
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              cn(
                'border-b-2 px-2 py-2 text-sm font-medium transition-colors sm:px-1',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
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
