import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
            <span className="text-sm font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
            <p className="mt-4 text-lg text-muted-foreground">{description}</p>
            <ul className="mt-6 space-y-3">
              {bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                  {bullet}
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant="ghost"
              className="mt-6 gap-1 px-0 text-primary hover:bg-transparent"
            >
              <Link to={link}>
                {linkLabel} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className={reversed ? 'lg:order-1' : ''}>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-lg">
              <img
                src={image}
                alt={imageAlt}
                className="w-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
              <div className="absolute inset-0 hidden items-center justify-center bg-muted/80 text-sm text-muted-foreground">
                {imageAlt}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
