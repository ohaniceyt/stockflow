import { MarketingHeader } from './MarketingHeader'
import { MarketingFooter } from './MarketingFooter'

interface LegalPageProps {
  title: string
  lastUpdated?: string
  children: React.ReactNode
}

export function LegalPage({ title, lastUpdated, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="px-4 py-16 sm:px-6 lg:px-8">
        <article className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          {lastUpdated ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Dernière mise à jour : {lastUpdated}
            </p>
          ) : null}

          <div className="prose prose-sm prose-slate mt-8 max-w-none dark:prose-invert">
            {children}
          </div>
        </article>
      </main>

      <MarketingFooter />
    </div>
  )
}
