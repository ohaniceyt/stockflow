import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  ChevronRight,
  ChevronLeft,
  Sparkles,
  ShoppingCart,
  Printer,
  CheckCircle,
} from 'lucide-react'

const steps = [
  {
    title: 'Bienvenue en caisse',
    body: 'Votre première vente est à portée de clic. Ce guide rapide vous montre comment scanner un produit, choisir un mode de paiement et imprimer un reçu.',
    icon: Sparkles,
  },
  {
    title: 'Ajoutez des produits',
    body: "Tapez le nom ou scannez le code-barres. Cliquez sur un produit pour l'ajouter au panier. Vous pouvez modifier la quantité ou le prix directement dans le panier.",
    icon: ShoppingCart,
  },
  {
    title: 'Finalisez la vente',
    body: 'Choisissez le mode de paiement, saisissez le montant reçu, puis cliquez sur "Encaisser". Le reçu s\'affiche automatiquement et peut être imprimé.',
    icon: Printer,
  },
  {
    title: "C'est parti",
    body: 'Vous êtes prêt(e). Faites votre première vente — le système enregistre tout dans votre historique.',
    icon: CheckCircle,
  },
]

export function FirstSaleWizard({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0)

  const current = steps[step]
  const Icon = current.icon
  const isLast = step === steps.length - 1

  return (
    <div className="rounded-xl border bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm dark:from-indigo-950 dark:to-background">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h3 className="font-semibold">{current.title}</h3>
          <p className="text-sm text-muted-foreground">
            Étape {(step + 1).toString()} sur {steps.length.toString()}
          </p>
        </div>
      </div>
      <p className="mb-6 text-sm leading-relaxed">{current.body}</p>
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${i === step ? 'bg-indigo-600' : 'bg-muted'}`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="mr-1 h-4 w-4" /> Retour
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={onDismiss}>
              Commencer <CheckCircle className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Suivant <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
