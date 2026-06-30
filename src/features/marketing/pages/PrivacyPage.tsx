import { LegalPage } from '../components/LegalPage'

export default function PrivacyPage() {
  return (
    <LegalPage title="Politique de confidentialité" lastUpdated="23 juin 2026">
      <p>
        StockFlow s’engage à protéger vos données personnelles et à respecter le Règlement Général
        sur la Protection des Données (RGPD).
      </p>

      <h2>1. Responsable du traitement</h2>
      <p>
        Le responsable du traitement est StockFlow, joignable à{' '}
        <a href="mailto:team@stockflow.grandigix.com">team@stockflow.grandigix.com</a>.
      </p>

      <h2>2. Données collectées</h2>
      <ul>
        <li>Identifiants : nom, prénom, adresse e-mail, numéro de téléphone.</li>
        <li>Données professionnelles : nom de l’organisation, adresse, identifiants fiscaux.</li>
        <li>Données d’activité : produits, stocks, mouvements, ventes, contacts, reçus.</li>
        <li>Données techniques : adresse IP, logs de connexion, cookies fonctionnels.</li>
      </ul>

      <h2>3. Finalités du traitement</h2>
      <ul>
        <li>Fournir et améliorer le service StockFlow.</li>
        <li>Gérer votre compte, votre organisation et vos utilisateurs.</li>
        <li>Assurer la sécurité, la facturation et le support client.</li>
        <li>Respecter nos obligations légales et fiscales.</li>
      </ul>

      <h2>4. Base légale</h2>
      <p>
        Les traitements reposent sur l’exécution du contrat, nos obligations légales, notre intérêt
        légitime en matière de sécurité, et, le cas échéant, sur votre consentement explicite.
      </p>

      <h2>5. Conservation</h2>
      <p>
        Les données sont conservées pendant la durée de votre abonnement, puis archivées ou
        supprimées selon les obligations légales applicables (notamment comptables et fiscales).
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Vous disposez d’un droit d’accès, de rectification, d’effacement, de limitation, de
        portabilité et d’opposition. Pour exercer vos droits, contactez-nous à l’adresse ci-dessus.
      </p>

      <h2>7. Sous-traitants</h2>
      <p>
        Nous utilisons Supabase pour l’hébergement de la base de données et de l’authentification,
        Vercel pour l’hébergement de l’application, et Resend pour l’envoi d’e-mails. Chaque
        sous-traitant est sélectionné pour ses garanties de sécurité et de confidentialité.
      </p>

      <h2>8. Sécurité</h2>
      <p>
        Nous mettons en œuvre des mesures techniques et organisationnelles : chiffrement en transit
        (TLS), chiffrement au repos, authentification sécurisée, contrôles d’accès et journalisation
        des actions sensibles.
      </p>
    </LegalPage>
  )
}
