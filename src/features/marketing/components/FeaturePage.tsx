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
  previewImage?: string
  previewLabel: string
  previewIcon: LucideIcon
  features: { icon: LucideIcon; title: string; description: string }[]
  benefits?: string[]
}

export function FeaturePage({
  eyebrow,
  title,
  description,
  primaryCta,
  primaryCtaLink,
  secondaryCta,
  secondaryCtaLink,
  previewImage,
  previewLabel,
  previewIcon: PreviewIcon,
  features,
  benefits,
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
              <div className="relative overflow-hidden rounded-2xl border bg-card p-2 shadow-lg">
                {previewImage ? (
                  <img
                    src={previewImage}
                    alt={previewLabel}
                    className="w-full rounded-xl object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                      e.currentTarget.parentElement
                        ?.querySelector('.fallback')
                        ?.classList.remove('hidden')
                    }}
                  />
                ) : null}
                <div
                  className={`fallback flex flex-col items-center justify-center rounded-xl bg-muted p-8 text-center text-sm text-muted-foreground ${
                    previewImage ? 'hidden' : ''
                  }`}
                  style={{ minHeight: '16rem' }}
                >
                  <PreviewIcon className="mb-2 h-8 w-8 text-primary" />
                  <span className="font-medium">{previewLabel}</span>
                  <span className="mt-1 text-xs">Capture d’écran à venir</span>
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

        {benefits && benefits.length > 0 && (
          <section className="px-4 py-20 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
              <div className="mb-12 text-center">
                <h2 className="text-3xl font-bold">
                  Pourquoi les PME choisissent cette fonctionnalité
                </h2>
                <p className="mt-4 text-muted-foreground">
                  Des bénéfices concrets pour votre activité.
                </p>
              </div>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {benefits.map((benefit) => (
                  <div
                    key={benefit}
                    className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-6"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                      ✓
                    </span>
                    <p className="text-sm font-medium">{benefit}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl rounded-2xl bg-primary p-8 text-center text-primary-foreground sm:p-12">
            <h2 className="text-3xl font-bold">Prêt à essayer ?</h2>
            <p className="mt-4 opacity-90">
              Rejoignez les PME qui gagnent du temps chaque jour avec Flowbill. 1 mois gratuit, sans
              engagement.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8">
              <Link to="/signup">Essayer 1 mois gratuit</Link>
            </Button>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  )
}
