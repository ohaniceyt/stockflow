# Audit — Pages légales et consentements RGPD

> Date : 2026-06-23
> Scope : `src/features/marketing/pages/*`, `src/features/marketing/components/CookieConsent.tsx`, `src/features/marketing/components/MarketingFooter.tsx`, `src/features/auth/pages/SignupPage.tsx`, `src/features/settings/pages/DataPrivacyPage.tsx`.
> Statut : Pages présentes et accessibles, mais le parcours d'inscription ne recueille pas explicitement le consentement.

---

## 1. Résumé exécutif

Les pages `/privacy`, `/terms` et `/cookies` existent, sont liées dans le pied de page marketing et mentionnent les sous-traitants, la région d'hébergement et les droits RGPD. Le bandeau cookies permet de refuser ou d'accepter.

Le principal écart réside dans le formulaire d'inscription : il n'obligeait pas l'utilisateur à accepter les CGU et la politique de confidentialité avant la création de compte. Ce consentement a été ajouté.

---

## 2. Contrôles positifs

| Domaine                   | Observation                                                                                | Preuve                               |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------ |
| Pages dédiées             | `/privacy`, `/terms`, `/cookies` sont des routes publiques dédiées.                        | `src/features/marketing/pages/*.tsx` |
| Liens dans le footer      | Toutes les pages légales sont accessibles depuis le pied de page marketing.                | `MarketingFooter.tsx`                |
| Bandeau cookies           | Bannière affichée avec choix "Tout accepter" / "Refuser" + lien vers la politique.         | `CookieConsent.tsx`                  |
| Data Residency            | La politique de confidentialité mentionne Supabase `eu-central-1`, Vercel Edge, Resend US. | `PrivacyPage.tsx` §7                 |
| Droits RGPD               | Mention des droits d'accès, rectification, effacement, portabilité, opposition.            | `PrivacyPage.tsx` §6                 |
| Page données personnelles | `/app/privacy` permet demande d'export/effacement.                                         | `DataPrivacyPage.tsx`                |

---

## 3. Risques et recommandations

| #   | Sévérité | Problème                                                                                     | Preuve                              | Recommandation                                                                                      |
| --- | -------- | -------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| 3.1 | **Haut** | Le formulaire d'inscription ne demandait pas l'acceptation explicite des CGU / politique.    | `SignupPage.tsx` (avant correction) | Ajouter une case à cocher obligatoire avec liens vers `/terms` et `/privacy`. ✅ Corrigé            |
| 3.2 | Moyen    | Le bandeau cookies n'offre pas de choix granulaire (analytiques vs marketing).               | `CookieConsent.tsx`                 | Envisager un bouton "Personnaliser" vers `/cookies` si des cookies marketing sont ajoutés.          |
| 3.3 | Moyen    | Aucune date de dernière mise à jour dynamique dans le footer.                                | `MarketingFooter.tsx`               | Les pages affichent déjà une date statique. Maintenir à jour lors des modifications substantielles. |
| 3.4 | Faible   | Les CGU mentionnent "droits non remboursables" sans préciser le délai de rétractation légal. | `TermsPage.tsx` §3                  | Ajouter une mention sur le droit de rétractation de 14 jours pour les consommateurs si applicable.  |
| 3.5 | Faible   | Le consentement cookie est stocké localement ; pas de preuve serveur.                        | `useCookieConsent.ts`               | Acceptable pour un consentement frontend ; documenter dans la politique.                            |

---

## 4. Plan d'action

### Immédiat

- [x] Ajouter case à cocher CGU/privacy sur `/signup`.

### Court terme

- [ ] Ajouter une mention sur le droit de rétractation dans les CGU.
- [ ] Maintenir la date de dernière mise à jour des pages légales lors des changements.
- [ ] Ajouter un choix granulaire des cookies si de nouveaux traceurs sont introduits.

### Moyen terme

- [ ] Faire relire les textes par un conseil juridique pour le marché cible (France / UE / Afrique francophone).
- [ ] Enregistrer les consentements utilisateur côté serveur si une preuve juridique devient nécessaire.

---

## 5. Vérifications

- [x] `/privacy`, `/terms`, `/cookies` sont accessibles sans authentification.
- [x] Footer marketing contient les liens.
- [x] `/signup` bloque la soumission tant que les CGU/privacy ne sont pas acceptées.
- [ ] Relire juridique des textes (hors scope technique).
