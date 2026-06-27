import { FeaturePage } from '../components/FeaturePage'
import { Package, MapPin, BarChart3, ScanLine, History, Boxes } from 'lucide-react'

export default function InventoryFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Gestion de stock"
      title="Votre inventaire sous contrôle, en temps réel"
      description="Fini les ruptures de stock surprises et les pertes inexpliquées. Suivez chaque produit, chaque emplacement et chaque mouvement dans une interface claire et rapide."
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
          description: 'Gérez du stock dans plusieurs entrepôts, boutiques ou points de vente.',
        },
        {
          icon: History,
          title: 'Historique traçable',
          description: 'Chaque mouvement est horodaté et rattaché à un opérateur.',
        },
        {
          icon: ScanLine,
          title: 'Scan rapide',
          description:
            'Utilisez la caméra de votre appareil pour scanner et rechercher des produits.',
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
          description: 'Notifications de stock faible, valorisation et rapports de rotation.',
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
