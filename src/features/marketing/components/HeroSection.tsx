import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const valueProps = [
  'Gérez le stock multi-emplacements',
  'Encaissez et facturez en un clic',
  'Fonctionne hors ligne',
]

export function HeroSection() {
  const [isDemoLoading, setIsDemoLoading] = useState(false)

  const handleWatchDemo = () => {
    setIsDemoLoading(true)
    // TODO: open demo modal or scroll to video section
    setTimeout(() => setIsDemoLoading(false), 1200)
  }

  return (
    <section className="relative overflow-hidden bg-background px-4 pt-16 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-sm">
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                vNext
              </span>
              <span className="text-muted-foreground">
                La gestion de stock repensée pour la PME africaine
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Vendez plus, <span className="text-primary">gérez mieux</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              StockFlow centralise votre inventaire, votre caisse, vos factures et vos analyses en
              une seule app rapide, offline-first et sécurisée.
            </p>
            <ul className="mt-8 space-y-3">
              {valueProps.map((prop) => (
                <li
                  key={prop}
                  className="flex items-center gap-2 text-sm font-medium text-foreground"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  {prop}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="gap-2">
                <Link to="/signup">
                  Essayer 1 mois gratuit <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="gap-2" onClick={handleWatchDemo}>
                {isDemoLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                Voir la démo
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              1 mois d’essai gratuit. Sans carte bancaire.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 to-primary/5 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl">
              <img
                src="/dashboard-preview.png"
                alt="Tableau de bord StockFlow"
                className="w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-sm text-muted-foreground">
                Aperçu du tableau de bord
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
