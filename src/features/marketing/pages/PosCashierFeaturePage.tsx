import { Receipt, Smartphone, CreditCard, RotateCcw, Printer, BarChart3 } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function PosCashierFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Caisse & POS"
      title="Encaissez rapidement, au comptoir ou en déplacement"
      description="Transformez n’importe quel téléphone ou tablette en caisse. Scannez les produits, encaissez en cash, par carte ou mobile money, et envoyez un reçu en quelques secondes."
      primaryCta="Essayer 1 mois gratuit"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewImage="/features/pos-preview.png"
      previewLabel="Aperçu de l’interface caisse"
      previewIcon={Receipt}
      features={[
        {
          icon: Receipt,
          title: 'Panier rapide',
          description: 'Ajoutez des produits par recherche, catégorie ou scan de code-barres.',
        },
        {
          icon: Smartphone,
          title: 'Scan avec votre téléphone',
          description: 'Utilisez la caméra comme scanner, sans matériel supplémentaire.',
        },
        {
          icon: CreditCard,
          title: 'Cash, carte & mobile money',
          description: 'Enregistrez le cash, les cartes et les paiements mobile money en un clic.',
        },
        {
          icon: Printer,
          title: 'Reçus et tickets',
          description: 'Imprimez, partagez par WhatsApp ou envoyez un reçu par email.',
        },
        {
          icon: RotateCcw,
          title: 'Annulations contrôlées',
          description: 'Annulez une vente avec journal d’audit et remise à jour du stock.',
        },
        {
          icon: BarChart3,
          title: 'Rapports de vente',
          description: 'Suivez les ventes par caissier, produit et mode de paiement en temps réel.',
        },
      ]}
      benefits={[
        'Réduisez les files d’attente',
        'Évitez les erreurs de caisse',
        'Accélérez les encaissements',
        'Suivez vos ventes en temps réel',
      ]}
    />
  )
}
