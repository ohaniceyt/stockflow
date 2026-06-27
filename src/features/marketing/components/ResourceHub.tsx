import { ArrowRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Resource {
  icon: LucideIcon
  title: string
  description: string
  href: string
}

interface ResourceHubProps {
  resources: Resource[]
}

export function ResourceHub({ resources }: ResourceHubProps) {
  return (
    <section id="resources" className="bg-muted/30 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 max-w-3xl">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ressources pour booster votre activité
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Guides, vidéos et modèles pour vendre plus et mieux gérer votre inventaire.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {resources.map((resource) => {
            const Icon = resource.icon
            return (
              <a
                key={resource.title}
                href={resource.href}
                className="group rounded-2xl border bg-background p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
              >
                <Icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-lg font-semibold">{resource.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{resource.description}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Lire la suite{' '}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </a>
            )
          })}
        </div>
      </div>
    </section>
  )
}
