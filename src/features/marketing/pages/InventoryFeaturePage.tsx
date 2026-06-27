import { Link } from 'react-router-dom'
import { Package, MapPin, ArrowRight, BarChart3, ScanLine, History, Boxes } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { MarketingHeader } from '../components/MarketingHeader'
import { MarketingFooter } from '../components/MarketingFooter'

const features = [
  {
    icon: Package,
    title: 'Catalogue produits complet',
    description: 'Codes-barres, catégories, prix d’achat, prix de vente, photos et variants.',
  },
  {
    icon: MapPin,
    title: 'Multi-emplacements',
    description: 'Gérez du stock dans plusieurs entrepôts, boutiques ou points de vente.',
  },
  {
    icon: History,
    title: 'Historique traçable',
    description: 'Chaque mouvement est horodaté et rattaché à un opérateur.',
  },
  {
    icon: ScanLine,
    title: 'Scan rapide',
    description: 'Utilisez la caméra de votre appareil pour scanner et rechercher des produits.',
  },
  {
    icon: Boxes,
    title: 'Transferts et ajustements',
    description: 'Déplacez du stock entre emplacements et ajustez les quantités avec contrôle.',
  },
  {
    icon: BarChart3,
    title: 'Alertes et rapports',
    description: 'Notifications de stock faible, valorisation et rapports de rotation.',
  },
]

export default function InventoryFeaturePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                  Gestion de stock
                </span>
                <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
                  Votre inventaire sous contrôle, en temps réel
                </h1>
                <p className="mt-6 text-lg text-muted-foreground">
                  Fini les ruptures de stock surprises et les pertes inexpliquées. Suivez chaque
                  produit, chaque emplacement et chaque mouvement dans une interface claire et
                  rapide.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg" className="gap-2">
                    <Link to="/signup">
                      Essayer gratuitement <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to="/pricing">Voir les tarifs</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border bg-card p-8 shadow-lg">
                <div className="flex h-64 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  Aperçu du catalogue produits
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Tout pour gérer votre stock</h2>
              <p className="mt-4 text-muted-foreground">
                Des fonctionnalités couvrant l’ensemble du cycle de vie de vos produits.
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => {
                const Icon = f.icon
                return (
                  <div key={f.title} className="rounded-2xl border bg-background p-6 shadow-sm">
                    <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold">{f.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{f.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <h2 className="text-3xl font-bold">Prêt à mieux gérer votre stock ?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Créez votre compte gratuit et importez votre catalogue en quelques minutes.
            </p>
            <Button asChild size="lg" className="mt-8 gap-2">
              <Link to="/signup">
                Démarrer maintenant <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
