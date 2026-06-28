import { Link } from './Link'
import { Logo } from './Logo'

const footerLinks = {
  Product: [
    { label: 'Gestion de stock', href: '/features/inventory' },
    { label: 'Caisse & POS', href: '/features/pos-cashier' },
    { label: 'Facturation', href: '/features/invoicing' },
    { label: 'Mode offline', href: '/features/offline' },
    { label: 'Analytics', href: '/features/analytics' },
    { label: 'Tarifs', href: '/pricing' },
  ],
  Company: [{ label: 'Contact', href: 'mailto:team@stockflow.grandigix.com' }],
  Resources: [
    { label: 'Documentation API', href: '#' },
    { label: "Centre d'aide", href: '#' },
  ],
  Legal: [{ label: 'Sécurité', href: '#security' }],
}

export function MarketingFooter() {
  return (
    <footer className="border-t bg-muted/30 px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-7" />
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              La gestion de stock, caisse et facturation simple et moderne pour les PME.
            </p>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold">{category}</h3>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : link.href.startsWith('#') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} StockFlow. Tous droits réservés.</p>
          <div className="flex gap-6">
            <a href="mailto:team@stockflow.grandigix.com" className="hover:text-foreground">
              Contact
            </a>
            <Link to="/login" className="hover:text-foreground">
              Connexion
            </Link>
            <Link to="/signup" className="hover:text-foreground">
              Inscription
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
