import { useState } from 'react'
import { ArrowRight, X, Zap } from 'lucide-react'
import { Link } from './Link'

export function TopBanner() {
  const [visible, setVisible] = useState(true)
  if (!visible) return null

  return (
    <div className="relative bg-primary px-4 py-2 text-center text-xs font-medium text-primary-foreground sm:text-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2">
        <Zap className="hidden h-4 w-4 sm:inline" />
        <span>StockFlow est maintenant disponible — gestion de stock, caisse et facturation.</span>
        <Link
          to="/signup"
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
        >
          Démarrer <ArrowRight className="h-3 w-3" />
        </Link>
        <button
          type="button"
          onClick={() => setVisible(false)}
          className="absolute right-2 top-1/2 flex h-10 min-h-[44px] w-10 min-w-[44px] -translate-y-1/2 items-center justify-center rounded-full hover:bg-primary-foreground/10 sm:right-4"
          aria-label="Fermer la bannière"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}
