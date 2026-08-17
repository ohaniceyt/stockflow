import { FeaturePage } from '../components/FeaturePage'
import { Package, MapPin, BarChart3, ScanLine, History, Boxes } from 'lucide-react'

export default function InventoryFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Gestion de stock"
      title="Votre inventaire sous contrôle, même à plusieurs entrepôts"
      description="Arrêtez de compter vos produits à la main. Suivez chaque article, chaque boutique et chaque mouvement en temps réel depuis votre téléphone ou votre ordinateur."
      primaryCta="Essayer 1 mois gratuit"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewImage="/features/inventory-preview.png"
      previewLabel="Aperçu de la gestion de stock"
      previewIcon={Package}
      features={[
        {
          icon: Package,
          title: 'Catalogue produits complet',
          description: 'Codes-barres, catégories, prix d’achat, prix de vente, photos et variants.',
        },
        {
          icon: MapPin,
          title: 'Multi-emplacements',
          description: 'Gérez du stock dans plusieurs boutiques ou entrepôts sans perdre le fil.',
        },
        {
          icon: History,
          title: 'Historique traçable',
          description:
            'Chaque entrée, sortie et ajustement est horodaté et rattaché à un opérateur.',
        },
        {
          icon: ScanLine,
          title: 'Scan rapide',
          description:
            'Utilisez la caméra de votre téléphone comme scanner pour vendre ou compter le stock.',
        },
        {
          icon: Boxes,
          title: 'Transferts et ajustements',
          description:
            'Déplacez du stock entre emplacements et ajustez les quantités avec contrôle.',
        },
        {
          icon: BarChart3,
          title: 'Alertes et rapports',
          description: 'Soyez alerté avant la rupture et consultez la valorisation de votre stock.',
        },
      ]}
      benefits={[
        'Réduisez les ruptures de stock',
        'Gagnez du temps sur les inventaires',
        'Évitez les pertes inexpliquées',
        'Prenez des décisions basées sur des données',
      ]}
    />
  )
}
