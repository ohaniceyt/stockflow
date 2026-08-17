import { useState } from 'react'
import { Link } from './Link'
import { MarketingButton } from './MarketingButton'
import { Menu, X, ChevronDown } from 'lucide-react'
import { Logo } from './Logo'

interface NavItem {
  label: string
  href: string
  children?: { label: string; href: string; description?: string }[]
}

const navItems: NavItem[] = [
  {
    label: 'Fonctionnalités',
    href: '#',
    children: [
      {
        label: 'Gestion de stock',
        href: '/features/inventory',
        description: 'Stock multi-emplacements en temps réel',
      },
      {
        label: 'Caisse & POS',
        href: '/features/pos-cashier',
        description: 'Ventes, scan et reçus',
      },
      {
        label: 'Mode offline',
        href: '/features/offline',
        description: 'Travaillez sans connexion',
      },
      { label: 'Analytics', href: '/features/analytics', description: 'Tableau de bord et KPIs' },
    ],
  },
]

export function MarketingHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex h-16 min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-sm"
          aria-label="StockFlow, retour à l'accueil"
        >
          <Logo className="h-8 w-auto" variant="icon" />
          <span className="text-lg font-bold tracking-tight">StockFlow</span>
        </Link>

        <nav
          className="hidden items-center gap-6 text-base font-medium md:flex"
          aria-label="Navigation principale"
        >
          {navItems.map((item) =>
            item.children ? (
              <details
                key={item.label}
                className="group relative"
                name="desktop-nav"
                data-testid="desktop-nav-item"
              >
                <summary className="flex h-10 cursor-pointer list-none items-center gap-1 rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.label}
                  <ChevronDown
                    className="h-4 w-4 transition-transform group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="absolute left-0 top-full mt-1 w-64 rounded-xl border bg-card p-2 shadow-lg">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      to={child.href}
                      className="block rounded-lg px-3 py-2.5 transition-colors hover:bg-accent"
                    >
                      <p className="text-base font-medium">{child.label}</p>
                      {child.description && (
                        <p className="text-sm leading-snug text-muted-foreground">
                          {child.description}
                        </p>
                      )}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                className="flex h-10 items-center rounded-md px-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <MarketingButton variant="ghost" size="sm" to="/login">
            Se connecter
          </MarketingButton>
          <MarketingButton size="sm" to="/signup">
            Essayer gratuit
          </MarketingButton>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-md p-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {mobileOpen ? (
            <X className="h-6 w-6" aria-hidden="true" />
          ) : (
            <Menu className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div
          id="mobile-menu"
          className="border-t bg-background px-4 py-4 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu mobile"
        >
          <nav className="flex flex-col gap-1" aria-label="Navigation mobile">
            {navItems.map((item) =>
              item.children ? (
                <div key={item.label} className="space-y-1 py-1">
                  <p className="px-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      to={child.href}
                      className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-base transition-colors hover:bg-accent"
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex min-h-[44px] items-center rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-accent"
                >
                  {item.label}
                </Link>
              )
            )}
            <div className="mt-2 flex flex-col gap-2 border-t pt-3">
              <MarketingButton variant="outline" size="sm" to="/login">
                Se connecter
              </MarketingButton>
              <MarketingButton size="sm" to="/signup">
                Essayer gratuit
              </MarketingButton>
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
