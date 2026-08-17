import { useState } from 'react'
import { ArrowRight, Play, CheckCircle2 } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { MarketingButton } from './MarketingButton'
import HeroDemoDialog from './HeroDemoDialog'

const valueProps = [
  'Stock, caisse et rapports dans une seule app',
  'Fonctionne même sans connexion internet',
  'Multi-boutiques, multi-emplacements, multi-devises',
  'Prêt pour la RGPD et la conformité locale',
]

export function HeroSection() {
  const [demoOpen, setDemoOpen] = useState(false)

  return (
    <section className="relative overflow-hidden bg-background px-4 pt-16 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-base">
              <span className="rounded-full bg-primary px-2 py-0.5 text-base font-medium text-primary-foreground">
                Nouveau
              </span>
              <span className="text-muted-foreground">
                La caisse-inventaire conçue pour les PME africaines
              </span>
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Vendez plus vite, <span className="text-primary">gérez sans stress</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              StockFlow centralise votre inventaire, votre caisse et vos analyses en une app rapide,
              offline-first et sécurisée. Conçu pour les boutiques, restaurants et distributeurs en
              Afrique.
            </p>
            <ul className="mt-8 space-y-3">
              {valueProps.map((prop) => (
                <li
                  key={prop}
                  className="flex items-center gap-2 text-base font-medium text-foreground"
                >
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                  {prop}
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-col gap-3 sm:flex-row">
              <MarketingButton to="/signup" size="lg" className="gap-2">
                Essayer 1 mois gratuit <ArrowRight className="h-4 w-4" />
              </MarketingButton>
              <MarketingButton
                variant="outline"
                size="lg"
                className="gap-2"
                onClick={() => setDemoOpen(true)}
                aria-label="Voir la démo"
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                Voir la démo
              </MarketingButton>
            </div>
            <p className="mt-4 text-base text-muted-foreground">
              1 mois d’essai gratuit. Sans carte bancaire. Annulation à tout moment.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-tr from-primary/20 to-primary/5 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-2xl">
              <OptimizedImage
                src="/dashboard-preview"
                alt="Tableau de bord StockFlow avec stock, ventes et alertes"
                width={1600}
                height={1000}
                className="w-full object-cover"
                loading="eager"
                fetchpriority="high"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80 text-base text-muted-foreground">
                Aperçu du tableau de bord
              </div>
            </div>
          </div>
        </div>
      </div>

      <HeroDemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </section>
  )
}
