import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { MarketingHeader } from './MarketingHeader'
import { MarketingFooter } from './MarketingFooter'

interface FeaturePageProps {
  eyebrow: string
  title: string
  description: string
  primaryCta: string
  primaryCtaLink: string
  secondaryCta: string
  secondaryCtaLink: string
  previewLabel: string
  features: { icon: LucideIcon; title: string; description: string }[]
}

export function FeaturePage({
  eyebrow,
  title,
  description,
  primaryCta,
  primaryCtaLink,
  secondaryCta,
  secondaryCtaLink,
  previewLabel,
  features,
}: FeaturePageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main>
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <span className="text-sm font-semibold uppercase tracking-wider text-primary">
                  {eyebrow}
                </span>
                <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
                <p className="mt-6 text-lg text-muted-foreground">{description}</p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button asChild size="lg">
                    <Link to={primaryCtaLink}>{primaryCta}</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link to={secondaryCtaLink}>{secondaryCta}</Link>
                  </Button>
                </div>
              </div>
              <div className="rounded-2xl border bg-card p-8 shadow-lg">
                <div className="flex h-64 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                  {previewLabel}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold">Fonctionnalités clés</h2>
              <p className="mt-4 text-muted-foreground">
                Découvrez ce qui rend cette fonctionnalité indispensable au quotidien.
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
            <h2 className="text-3xl font-bold">Prêt à essayer ?</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Rejoignez les PME qui gagnent du temps chaque jour avec StockFlow.
            </p>
            <Button asChild size="lg" className="mt-8">
              <Link to="/signup">Essayer 1 mois gratuit</Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
