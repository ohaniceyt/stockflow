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
        label: 'Facturation',
        href: '/features/invoicing',
        description: 'Devis, factures et rappels',
      },
      {
        label: 'Mode offline',
        href: '/features/offline',
        description: 'Travaillez sans connexion',
      },
      { label: 'Analytics', href: '/features/analytics', description: 'Tableau de bord et KPIs' },
    ],
  },
  { label: 'Tarifs', href: '/pricing' },
  { label: 'Ressources', href: '#resources' },
]

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <Logo className="h-8" />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
          {navItems.map((item) =>
            item.children ? (
              <details key={item.label} className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                  {item.label}
                  <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                </summary>
                <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border bg-card p-2 shadow-lg">
                  {item.children.map((child) => (
                    <Link
                      key={child.label}
                      to={child.href}
                      className="block rounded-lg px-3 py-2 hover:bg-accent"
                    >
                      <p className="text-sm font-medium">{child.label}</p>
                      {child.description && (
                        <p className="text-xs text-muted-foreground">{child.description}</p>
                      )}
                    </Link>
                  ))}
                </div>
              </details>
            ) : (
              <Link
                key={item.label}
                to={item.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <MarketingButton variant="ghost" size="sm" to="/login">Se connecter</MarketingButton>
          <MarketingButton size="sm" to="/signup">Essayer gratuit</MarketingButton>
        </div>

        <details className="group md:hidden">
          <summary
            className="flex min-h-[44px] min-w-[44px] cursor-pointer list-none items-center justify-center rounded-md p-2 [&::-webkit-details-marker]:hidden"
            aria-label="Ouvrir le menu"
          >
            <span className="group-open:hidden">
              <Menu className="h-6 w-6" />
            </span>
            <span className="hidden group-open:block">
              <X className="h-6 w-6" />
            </span>
          </summary>

          <div className="border-t bg-background px-4 py-4 md:hidden">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) =>
                item.children ? (
                  <div key={item.label} className="space-y-1">
                    <p className="text-sm font-semibold text-muted-foreground">{item.label}</p>
                    {item.children.map((child) => (
                      <Link
                        key={child.label}
                        to={child.href}
                        className="block rounded-lg px-3 py-2 text-sm hover:bg-accent"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent"
                  >
                    {item.label}
                  </Link>
                )
              )}
              <div className="mt-2 flex flex-col gap-2 border-t pt-3">
                <MarketingButton variant="outline" size="sm" to="/login">Se connecter</MarketingButton>
                <MarketingButton size="sm" to="/signup">Essayer gratuit</MarketingButton>
              </div>
            </nav>
          </div>
        </details>
      </div>
    </header>
  )
}
