import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { OptimizedImage } from '@/components/OptimizedImage'
import { MarketingButton } from './MarketingButton'

interface FeatureBlockProps {
  eyebrow: string
  title: string
  description: string
  bullets: string[]
  image: string
  imageAlt: string
  link: string
  linkLabel: string
  reversed?: boolean
  icon: LucideIcon
}

export function FeatureBlock({
  eyebrow,
  title,
  description,
  bullets,
  image,
  imageAlt,
  link,
  linkLabel,
  reversed = false,
  icon: Icon,
}: FeatureBlockProps) {
  return (
    <section className="px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div
          className={`grid items-center gap-12 lg:grid-cols-2 ${reversed ? 'lg:flex-row-reverse' : ''}`}
        >
          <div className={reversed ? 'lg:order-2' : ''}>
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-6 w-6" />
            </div>
            <span className="text-base font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{description}</p>
            <ul className="mt-6 space-y-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-base text-foreground">
                  <span className="mt-1.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                    ✓
                  </span>
                  {bullet}
                </li>
              ))}
            </ul>
            <MarketingButton
              to={link}
              variant="ghost"
              className="mt-6 gap-1 px-0 text-primary hover:bg-transparent"
            >
              {linkLabel} <ArrowRight className="h-4 w-4" />
            </MarketingButton>
          </div>

          <div className={reversed ? 'lg:order-1' : ''}>
            <div className="relative overflow-hidden rounded-2xl border bg-card shadow-lg">
              <OptimizedImage
                src={image.replace(/\.png$/, '')}
                alt={imageAlt}
                width={1600}
                height={1000}
                className="w-full object-cover"
                loading="lazy"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
              <div className="fallback absolute inset-0 flex flex-col items-center justify-center bg-muted/80 p-6 text-center text-base text-muted-foreground">
                <Icon className="mb-2 h-8 w-8 text-primary" />
                <span className="font-medium">{imageAlt}</span>
                <span className="mt-1 text-base">Capture d’écran à venir</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
