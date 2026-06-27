import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function FinalCta() {
  return (
    <section className="bg-muted px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
          Prêt à transformer votre gestion de stock ?
        </h2>
        <p className="mt-6 text-lg text-muted-foreground">
          Créez un compte gratuit en 2 minutes et découvrez ce que StockFlow peut faire pour votre
          entreprise.
        </p>
        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link to="/signup">
              Démarrer gratuitement <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/pricing">Voir les tarifs</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
