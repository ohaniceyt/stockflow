import { WifiOff, RotateCcw, ShieldCheck, Clock, Cloud, Zap } from 'lucide-react'
import { FeaturePage } from '../components/FeaturePage'

export default function OfflineFeaturePage() {
  return (
    <FeaturePage
      eyebrow="Mode offline"
      title="Votre caisse et votre stock suivent partout, même sans réseau"
      description="La connexion saute ? Pas de panique. Vos ventes, mouvements et ajustements sont enregistrés localement puis synchronisés automatiquement dès le retour du réseau."
      primaryCta="Essayer 1 mois gratuit"
      primaryCtaLink="/signup"
      secondaryCta="Voir les tarifs"
      secondaryCtaLink="/pricing"
      previewLabel="Synchronisation automatique en arrière-plan"
      previewIcon={WifiOff}
      features={[
        {
          icon: WifiOff,
          title: 'Travail hors ligne natif',
          description:
            'Vendez et gérez le stock sans connexion, depuis votre téléphone ou tablette.',
        },
        {
          icon: RotateCcw,
          title: 'Synchronisation intelligente',
          description: 'Les données locales remontent automatiquement au retour du réseau.',
        },
        {
          icon: ShieldCheck,
          title: 'Détection de conflits',
          description: 'StockFlow détecte les conflits et vous aide à les résoudre simplement.',
        },
        {
          icon: Clock,
          title: 'File d’attente locale',
          description: 'Vos actions sont conservées en file d’attente tant que le réseau manque.',
        },
        {
          icon: Cloud,
          title: 'Backup automatique',
          description: 'Les données synchronisées sont sauvegardées sur le cloud.',
        },
        {
          icon: Zap,
          title: 'Performance locale',
          description: 'Interface rapide même avec une connexion faible ou instable.',
        },
      ]}
      benefits={[
        'Ne perdez plus de ventes à cause du réseau',
        'Travaillez dans les zones rurales ou en déplacement',
        'Synchronisez automatiquement au retour en ligne',
        'Gardez vos données en sécurité',
      ]}
    />
  )
}
