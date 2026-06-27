import { Receipt, Smartphone, CreditCard, RotateCcw, Printer, BarChart3 } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function PosCashierFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Caisse & POS"
      title="Une caisse rapide pour vendre sans file d’attente"
      description="Transformez n’importe quel appareil en point de vente. Scannez les produits, encaissez en cash, par carte ou mobile money, et imprimez des reçus en quelques secondes."
      primaryCta="Essayer la caisse"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewLabel="Aperçu de l’interface caisse"
      features={[
        {
          icon: Receipt,
          title: 'Panier rapide',
          description: 'Ajoutez des produits par recherche, code-barres ou catégorie.',
        },
        {
          icon: Smartphone,
          title: 'Scan code-barres',
          description: 'Utilisez la caméra de votre téléphone comme scanner.',
        },
        {
          icon: CreditCard,
          title: 'Paiements multiples',
          description: 'Cash, carte, mobile money et paiements mixtes supportés.',
        },
        {
          icon: Printer,
          title: 'Reçus et tickets',
          description: 'Imprimez ou partagez les reçus par email et messagerie.',
        },
        {
          icon: RotateCcw,
          title: 'Annulations contrôlées',
          description: 'Annulez une vente avec journal d’audit et mise à jour du stock.',
        },
        {
          icon: BarChart3,
          title: 'Rapports de vente',
          description: 'Suivez les ventes par caissier, produit et mode de paiement.',
        },
      ]}
    />
  )
}
