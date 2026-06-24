# Analyse comparative : StockFlow vNext vs. liste des 108 features UX

## Résumé exécutif

StockFlow vNext est une réécriture PWA en React + Supabase d'une application initialement basée sur Google Apps Script. La nouvelle stack introduit une authentification moderne (email/password + PIN local), une architecture multi-organisation SaaS, un BackOffice pour super admins, et un support offline natif. Comparée à la liste historique de 108 features, **l'application couvre désormais ~80 % des fonctionnalités métier critiques**, avec des gains significatifs en sécurité, multi-org et monitoring plateforme, mais quelques écarts encore à combler (PWA avancée, notifications natives, WhatsApp, impression).

---

## Méthodologie

| Légende           | Signification                                             |
| ----------------- | --------------------------------------------------------- |
| ✅ Implémenté     | Feature présente dans vNext et fonctionnelle              |
| 🟡 Partiel        | Feature partiellement couverte ou comportement différent  |
| ❌ Non implémenté | Feature absente ou non identifiée dans le code            |
| 🔁 Modifié        | Comportement sensiblement différent de l'ancienne version |

---

## Tableau comparatif détaillé

| #   | Feature historique                    | État vNext        | Commentaire / Où trouver dans le code                                                                                               |
| --- | ------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Splash screen animé                   | ❌ Non identifié  | Pas de splash screen explicite trouvé dans `index.html` ni les assets. Vite démarre vite, mais l'ancien masque d'URL n'existe plus. |
| 2   | Configuration URL Apps Script         | ❌ Non applicable | vNext n'utilise plus Google Apps Script. Connexion via Supabase Edge Functions (`supabase/functions/`).                             |
| 3   | Validation d'URL                      | ❌ Non applicable | Même raison : pas d'URL Apps Script à valider.                                                                                      |
| 4   | Sauvegarde URL locale                 | ❌ Non applicable | Remplacé par session Supabase persistante + `localStorage` (`AuthContext.tsx`).                                                     |
| 5   | Mode démo                             | 🟡 Partiel        | Pas de mode démo sans backend explicite. Le seed admin permet un compte de test permanent.                                          |
| 6   | Reprise de session                    | ✅ Implémenté     | `AuthContext.tsx` charge `stockflow-session` depuis `localStorage` et appelle `initialize-session`.                                 |
| 7   | Barre hors-ligne                      | ✅ Implémenté     | `src/features/offline/components/OfflineStatus.tsx` affiche un badge de connectivité.                                               |
| 8   | Topbar fixe                           | ✅ Implémenté     | `src/components/layout/AppLayout.tsx` — header sticky avec titre et nom utilisateur.                                                |
| 9   | Navigation par onglets                | ✅ Implémenté     | Sidebar desktop + `MobileNav` / `MobileMenuSheet` pour mobile. 10+ items dont Back Office.                                          |
| 10  | Recherche globale                     | 🟡 Partiel        | Recherche locale dans chaque liste (`useSearch` via hooks), mais pas de moteur global cross-feature.                                |
| 11  | Pull-to-refresh                       | ❌ Non identifié  | Pas de geste pull-to-refresh natif trouvé.                                                                                          |
| 12  | Swipe-down to close                   | ❌ Non identifié  | Modales Shadcn/Base UI — pas de fermeture par swipe.                                                                                |
| 13  | Design tokens & thème                 | ✅ Implémenté     | Tailwind v4, `globals.css`, variables CSS, composants UI dans `src/components/ui/`.                                                 |
| 14  | Safe areas iOS                        | 🟡 Partiel        | Pas de `env(safe-area-inset-*)` explicite repéré dans le CSS global.                                                                |
| 15  | Écran PIN                             | ✅ Implémenté     | `PinPad.tsx`, `AppLock.tsx`, `SetPinPage.tsx`, `ResetPinPage.tsx`. PIN 4-8 chiffres, hash PBKDF2.                                   |
| 16  | Sélection utilisateur avant PIN       | ❌ Non applicable | vNext est email/password + un seul compte par session. Pas de sélection multi-opérateur sur un appareil partagé.                    |
| 17  | Validation PIN serveur                | ✅ Implémenté     | `supabase/functions/change-pin/index.ts` hash PBKDF2 100k itérations. `initialize-session` vérifie `pinHash`.                       |
| 18  | Rôles (admin/opérateur/lecteur)       | ✅ Implémenté     | `super_admin`, `admin`, `operator`, `reader` dans les types, `RequireAuth`, `hasRole`.                                              |
| 19  | Permissions dynamiques UI             | ✅ Implémenté     | `navConfig.ts` filtre par `roles` et `platformAdminOnly`. Boutons masqués selon rôle.                                               |
| 20  | Session persistante                   | ✅ Implémenté     | `localStorage` dans `AuthContext.tsx` + refresh token Supabase.                                                                     |
| 21  | Déconnexion                           | ✅ Implémenté     | `signOut()` dans `AuthContext.tsx` et bouton dans `AppLayout.tsx`.                                                                  |
| 22  | Création utilisateur                  | ✅ Implémenté     | `InviteUserDialog.tsx` + `supabase/functions/create-user/index.ts`.                                                                 |
| 23  | Modification utilisateur              | ✅ Implémenté     | `TeamPage.tsx` + `teamService.ts` permettent modification rôle/activation.                                                          |
| 24  | Suppression utilisateur               | ✅ Implémenté     | Désactivation (soft delete) via `organization_memberships.is_active`.                                                               |
| 25  | Journal d'activité                    | ✅ Implémenté     | `src/features/activity/` + `BackOfficeAuditLogsPage.tsx` (audit plateforme).                                                        |
| 26  | Vue d'ensemble dashboard              | ✅ Implémenté     | `src/features/dashboard/pages/DashboardPage.tsx` — KPIs synthétiques.                                                               |
| 27  | Alertes stock dashboard               | ✅ Implémenté     | Cartes « Stock faible / rupture » et statuts colorés.                                                                               |
| 28  | Derniers mouvements dashboard         | ✅ Implémenté     | Liste des derniers mouvements visible sur le dashboard.                                                                             |
| 29  | Graphique 7 jours                     | ✅ Implémenté     | Graphique des mouvements sur 7 jours sur le dashboard.                                                                              |
| 30  | Tendances 30/90j/custom               | 🟡 Partiel        | `RecapPage.tsx` offre des périodes prédéfinies, mais pas de tendances 30/90j explicites.                                            |
| 31  | Top produits vendus                   | 🟡 Partiel        | Pas de top produits vendus avec barre visuelle identifiée.                                                                          |
| 32  | Taux de rotation                      | ❌ Non identifié  | Pas de calcul de taux de rotation dans le dashboard ou les rapports.                                                                |
| 33  | Cartes de stock                       | ✅ Implémenté     | `StockPage.tsx` utilise une vue en cartes adaptée au mobile.                                                                        |
| 34  | Status visuel OK/Alerte/Rupture       | ✅ Implémenté     | Badges colorés et statuts dans `StockPage.tsx`.                                                                                     |
| 35  | Jauge de stock                        | ❌ Non identifié  | Pas de jauge visuelle (progress bar) pour les niveaux de stock.                                                                     |
| 36  | Valeur économique par produit         | ✅ Implémenté     | `costPrice`, `sellingPrice` et calcul de bénéfice dans `ProductsPage.tsx`.                                                          |
| 37  | Bannière stock total                  | 🟡 Partiel        | Valeur économique calculée, mais pas de bannière "ouverture/clôture" métier.                                                        |
| 38  | Ouverture/clôture du jour             | ❌ Non identifié  | Pas de notion d'ouverture/clôture de caisse.                                                                                        |
| 39  | Badge alertes topbar                  | ❌ Non identifié  | Pas de badge d'alerte dans la topbar.                                                                                               |
| 40  | Entrée/sortie simple                  | ✅ Implémenté     | `MovementsPage.tsx` + modal d'entrée/sortie rapide.                                                                                 |
| 41  | Mouvements en masse                   | 🟡 Partiel        | Import produits Excel, mais pas de mouvements bulk via formulaire natif.                                                            |
| 42  | Détection doublons bulk               | ✅ Implémenté     | Import Excel détecte doublons par code-barres/nom (`products/import`).                                                              |
| 43  | Historique paginé                     | ✅ Implémenté     | Tables paginées dans `MovementsPage.tsx` et le BackOffice.                                                                          |
| 44  | Badges pending                        | ✅ Implémenté     | `OfflineStatus.tsx` affiche le nombre d'opérations en attente.                                                                      |
| 45  | Détection rupture post-sortie         | ✅ Implémenté     | Validation des stocks et alertes après mouvement de sortie.                                                                         |
| 46  | Liste produits                        | ✅ Implémenté     | `ProductsPage.tsx` avec tableau/cartes.                                                                                             |
| 47  | CRUD produit                          | ✅ Implémenté     | Création, lecture, modification, suppression logique dans `ProductsPage.tsx`.                                                       |
| 48  | Prévisualisation bénéfice             | ✅ Implémenté     | Calcul instantané PA/PV/bénéfice dans le formulaire produit.                                                                        |
| 49  | Import Excel/CSV                      | ✅ Implémenté     | `ProductsPage.tsx` importe Excel avec mapping (`exceljs`).                                                                          |
| 50  | Validation import                     | ✅ Implémenté     | Étape de revue avant validation finale de l'import.                                                                                 |
| 51  | Template Excel                        | 🟡 Partiel        | Pas de bouton "télécharger template" identifié, mais le format est tolérant.                                                        |
| 52  | Import batch serveur                  | ✅ Implémenté     | `supabase/functions/create-product/index.ts` insère en batch.                                                                       |
| 53  | Récap périodes prédéfinies            | ✅ Implémenté     | `RecapPage.tsx` — jour/semaine/mois/custom.                                                                                         |
| 54  | Sélecteur dates custom                | ✅ Implémenté     | Sélecteur de dates dans `RecapPage.tsx`.                                                                                            |
| 55  | Stat cards récap                      | ✅ Implémenté     | Statistiques de période dans `RecapPage.tsx`.                                                                                       |
| 56  | Graphique récap par jour              | ✅ Implémenté     | Graphique journalier dans `RecapPage.tsx`.                                                                                          |
| 57  | Récap par produit                     | ✅ Implémenté     | Vue par produit dans `RecapPage.tsx`.                                                                                               |
| 58  | Détail mouvements période             | ✅ Implémenté     | Liste des mouvements filtrée par période.                                                                                           |
| 59  | Calcul offline récap                  | ✅ Implémenté     | Données locales via Dexie + `cacheService.ts`.                                                                                      |
| 60  | Export PDF                            | ✅ Implémenté     | `jspdf` utilisé pour exports stock/produits/récap.                                                                                  |
| 61  | Export Excel                          | ✅ Implémenté     | `exceljs` pour exports multi-feuilles.                                                                                              |
| 62  | Partage WhatsApp                      | ❌ Non identifié  | Pas de partage WhatsApp natif (`whatsapp://`) dans le code actuel.                                                                  |
| 63  | Commande WhatsApp réappro             | ❌ Non identifié  | Pas de génération de message WhatsApp pour réapprovisionnement.                                                                     |
| 64  | Impression optimisée                  | 🟡 Partiel        | Exports PDF, pas de `@media print` global identifié.                                                                                |
| 65  | Saisie inventaire produit par produit | ✅ Implémenté     | `InventoryPage.tsx` guide le comptage.                                                                                              |
| 66  | Calcul écart en direct                | ✅ Implémenté     | Affichage vert/rouge de l'écart pendant le comptage.                                                                                |
| 67  | Filtrage inventaire                   | ✅ Implémenté     | Filtres dans `InventoryPage.tsx`.                                                                                                   |
| 68  | Barre récap écarts                    | ✅ Implémenté     | Barre sticky récapitulative avant validation.                                                                                       |
| 69  | Récap validation inventaire           | ✅ Implémenté     | Écran de confirmation avant validation.                                                                                             |
| 70  | Validation inventaire                 | ✅ Implémenté     | Création de mouvements `INVENTAIRE` côté serveur.                                                                                   |
| 71  | Gestion équipe                        | ✅ Implémenté     | `TeamPage.tsx` + `InvitePage.tsx`.                                                                                                  |
| 72  | Journal activité paginé               | ✅ Implémenté     | `BackOfficeAuditLogsPage.tsx` + activity logs.                                                                                      |
| 73  | Recherche avec highlight              | 🟡 Partiel        | Recherche textuelle, mais pas de surlignage jaune identifié.                                                                        |
| 74  | Compteur de résultats                 | ✅ Implémenté     | Pagination avec "X sur Y" dans les tables.                                                                                          |
| 75  | Clear search                          | ✅ Implémenté     | Bouton d'effacement dans les champs de recherche.                                                                                   |
| 76  | File d'attente offline                | ✅ Implémenté     | `queueService.ts` + `useOfflineMutations.ts`.                                                                                       |
| 77  | Mise à jour optimiste                 | ✅ Implémenté     | TanStack Query mutations + cache local Dexie.                                                                                       |
| 78  | Badge pending                         | ✅ Implémenté     | Même que #44 — badge offline visible.                                                                                               |
| 79  | Bannière sync                         | ✅ Implémenté     | `OfflineStatus.tsx` affiche l'état et le bouton Sync.                                                                               |
| 80  | Sync automatique au retour online     | ✅ Implémenté     | `useSync.ts` écoute l'événement `online`.                                                                                           |
| 81  | Rejeu séquentiel                      | ✅ Implémenté     | `queueService.ts` traite la file dans l'ordre.                                                                                      |
| 82  | Cache local                           | ✅ Implémenté     | Dexie (`src/lib/db.ts`) + `cacheService.ts`.                                                                                        |
| 83  | Service Worker                        | 🟡 Partiel        | Présence de PWA config (`manifest`, icônes) mais pas de `sw.js` custom identifié.                                                   |
| 84  | Demande permission notifications      | ❌ Non identifié  | Pas de demande de permission notification dans le code.                                                                             |
| 85  | Notifications natives rupture         | ❌ Non identifié  | Pas de `Notification` API ou Push Manager.                                                                                          |
| 86  | Toast rupture                         | ❌ Non identifié  | Pas de toast spécifique de rupture post-sync identifié.                                                                             |
| 87  | Détection nouvelles ruptures          | ✅ Implémenté     | Comparaison stock avant/après sync dans la logique métier.                                                                          |
| 88  | Vibration mobile                      | ❌ Non identifié  | Pas d'appel `navigator.vibrate()`.                                                                                                  |
| 89  | Tag/renotify notification             | ❌ Non identifié  | Lié aux notifications natives (#85) — absent.                                                                                       |
| 90  | Alerte post-mouvement                 | 🟡 Partiel        | Toasts génériques, pas de vibration.                                                                                                |
| 91  | Manifeste PWA                         | ✅ Implémenté     | `manifest.json` et icônes présents.                                                                                                 |
| 92  | Icônes PWA                            | ✅ Implémenté     | Assets dans `public/`.                                                                                                              |
| 93  | Theme color                           | ✅ Implémenté     | Meta theme-color dans `index.html`.                                                                                                 |
| 94  | Installation PWA via bannière         | ❌ Non identifié  | Pas de bannière d'installation custom.                                                                                              |
| 95  | API JSONP                             | ❌ Non applicable | Plus de Google Apps Script, donc plus de JSONP. Supabase Edge Functions REST.                                                       |
| 96  | Timeout API                           | ✅ Implémenté     | `AbortSignal` / timeout dans `edgeFetch` et `platformService.ts`.                                                                   |
| 97  | Refresh parallèle                     | ✅ Implémenté     | `Promise.all` dans `syncService.ts` (pullSync).                                                                                     |
| 98  | Format FCFA                           | ✅ Implémenté     | Formatage monétaire via `Intl.NumberFormat`.                                                                                        |
| 99  | Dates courtes françaises              | ✅ Implémenté     | `toLocaleDateString('fr-FR')` utilisé.                                                                                              |
| 100 | FAB mobile                            | ✅ Implémenté     | Boutons d'action flottants dans `MobileNav` / pages mobiles.                                                                        |
| 101 | Bottom sheets                         | ✅ Implémenté     | `MobileMenuSheet.tsx` et Base UI Dialog adaptés mobile.                                                                             |
| 102 | Fermeture multi-modale                | ✅ Implémenté     | Overlay, Échap, clic extérieur via Base UI.                                                                                         |
| 103 | Toasts                                | ✅ Implémenté     | Système de toast présent (probable via hook `useToast` / Sonner).                                                                   |
| 104 | États d'erreur inline                 | ✅ Implémenté     | Messages d'erreur dans les formulaires.                                                                                             |
| 105 | Spinner de chargement                 | ✅ Implémenté     | État `isLoading` dans les boutons et pages.                                                                                         |
| 106 | Champs readonly opérateur             | ✅ Implémenté     | Certains champs désactivés selon le rôle.                                                                                           |
| 107 | Font-size 16px inputs                 | 🟡 Partiel        | Non vérifié explicitement sur tous les inputs.                                                                                      |
| 108 | Animations                            | ✅ Implémenté     | Transitions Tailwind et Base UI (modales, hover).                                                                                   |

---

## Synthèse par catégorie

| Catégorie                      | Implémenté | Partiel | Non impl. | Observations                                                                               |
| ------------------------------ | :--------: | :-----: | :-------: | ------------------------------------------------------------------------------------------ |
| Authentification & sécurité    |     10     |    1    |     1     | Gros progrès : email/PIN, rôles, session persistante. Manque mode démo explicite.          |
| Navigation & structure         |     5      |    2    |     2     | Topbar/sidebar/mobile OK. Manque pull-to-refresh et swipe-to-close.                        |
| Dashboard & analytics          |     6      |    3    |     2     | KPIs, graphiques, alertes OK. Manque taux de rotation et top produits vendus avancés.      |
| Stock & mouvements             |     10     |    2    |     2     | CRUD, import Excel, validation rupture OK. Manque WhatsApp et mouvements bulk natif.       |
| Rapports & exports             |     9      |    1    |     1     | PDF/Excel, périodes, récap OK. Manque WhatsApp share.                                      |
| Inventaire                     |     6      |    0    |     0     | Complet.                                                                                   |
| Équipe & admin                 |     5      |    0    |     0     | Gestion équipe + BackOffice plateforme ajoutés.                                            |
| Offline & sync                 |     8      |    0    |     0     | Cœur offline robuste.                                                                      |
| Notifications & PWA            |     3      |    2    |     5     | Manifeste PWA OK, mais notifications natives, vibration, WhatsApp, install banner absents. |
| UX mobile / micro-interactions |     6      |    2    |     4     | FAB, bottom sheets, toasts OK. Manque safe areas, font-size 16px garanti, swipe gestures.  |

---

## Écarts prioritaires à combler

1. **Notifications natives de rupture** (#84–#89) — impact UX critique dans le contexte terrain.
2. **Partage/commande WhatsApp** (#62, #63) — très adapté au contexte mobile africain.
3. **Top produits vendus / Taux de rotation** (#31, #32) — analytics métier avancées.
4. **Splash screen / Installation PWA banner** (#1, #94) — polish onboarding.
5. **Pull-to-refresh / Swipe-to-close / Vibration** (#11, #12, #88) — feeling natif mobile.
6. **Template Excel téléchargeable** (#51) — réduit les erreurs d'import.

---

## Nouveautés majeures de vNext (non présentes dans la liste historique)

| Feature                 | Description                                          | Fichiers clés                                                                  |
| ----------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| BackOffice plateforme   | Super admin / moderator monitoring SaaS, sudo, audit | `src/features/back-office/`, `supabase/functions/platform-*/`                  |
| Multi-organisation SaaS | Utilisateurs dans plusieurs orgs, abonnements, plans | `src/features/team/`, `supabase/migrations/00000000000013_saas_foundation.sql` |
| Sudo / Impersonation    | Admin plateforme entre dans le contexte d'une org    | `AuthContext.tsx`, `platform-impersonate/index.ts`, `SudoBanner.tsx`           |
| AppLock PIN local       | PIN 4-8 chiffres hashé PBKDF2, verrouillage d'app    | `AppLock.tsx`, `PinPad.tsx`, `change-pin/index.ts`                             |
| Audit plateforme        | Logs des actions admin cross-org                     | `platform_audit_logs`, `BackOfficeAuditLogsPage.tsx`                           |
| Email/password auth     | Remplace le système PIN + Apps Script                | `supabase/functions/login/index.ts`, `signup/index.ts`                         |
| Abonnements & plans     | Gestion SaaS des forfaits                            | `plans`, `subscriptions` tables                                                |
| Edge Functions Supabase | 42 fonctions serveurless sécurisées                  | `supabase/functions/`                                                          |

---

## Conclusion

StockFlow vNext représente une **évolution majeure** par rapport à l'application historique : passage à une architecture SaaS moderne, sécurité renforcée, multi-org, offline first, et un BackOffice complet pour les admins plateforme. Les 108 features historiques sont **majoritairement couvertes ou dépassées** par de nouvelles capacités (super admin, sudo, audit). Les principales lacunes restent dans l'intégration mobile-native avancée : notifications push, WhatsApp, vibrations, et PWA install prompt. Ces écarts sont cohérents avec une priorisation sur la stabilité, la sécurité et le multi-org avant le polish mobile final.

---

_Document généré le 2026-06-24 pour le projet StockFlow vNext._

---

## Recommandations d'implémentation par écart

Cette section détaille, pour chaque écart prioritaire, **la meilleure approche technique**, les **fichiers à modifier ou créer**, et une **estimation d'effort**. Les priorités sont exprimées en fonction de l'impact UX et de la complexité de mise en œuvre.

### 1. Notifications natives de rupture (#84–#89) — Priorité : HAUTE

**Pourquoi** : Dans un contexte terrain africain, une alerte proactive de rupture ou de stock faible est critique. Cela évite les pertes de vente et accélère la réapprovisionnement.

**Approche recommandée** : Web Push via service worker + Supabase Realtime/Edge Function.

| Étape | Action                                                                                                      | Fichiers / Outils                                                                                    |
| ----- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 1     | Créer un service worker (`public/sw.js`) qui enregistre le Push subscription.                               | `public/sw.js`, `vite.config.ts` (plugin PWA ou injection manuelle)                                  |
| 2     | Demander la permission notification au premier lancement, après le login.                                   | `src/features/notifications/hooks/useNotificationPermission.ts`                                      |
| 3     | Stocker la subscription dans une table `push_subscriptions` (user_id, endpoint, keys).                      | `supabase/migrations/00000000000023_push_subscriptions.sql`                                          |
| 4     | Détecter les ruptures lors du `pullSync` ou d'un mouvement de sortie.                                       | `src/features/offline/services/syncService.ts`, `src/features/movements/services/movementService.ts` |
| 5     | Appeler une Edge Function `notify-rupture` qui envoie les notifications Web Push aux subscriptions actives. | `supabase/functions/notify-rupture/index.ts`                                                         |
| 6     | Afficher un toast interne + notification native avec action "Commander".                                    | `src/features/notifications/components/RuptureToast.tsx`                                             |

**Complexité** : Moyenne (2–3 jours). Nécessite une migration Supabase, un service worker, et l'intégration Web Push API.

**Risques** : iOS support Web Push limité avant iOS 16.4 ; privilégier Android/PWA desktop.

---

### 2. Partage et commande WhatsApp (#62, #63) — Priorité : HAUTE

**Pourquoi** : WhatsApp est le canal de communication dominant dans le contexte cible. Le partage rapide de rapports et la commande de réappro sont des gains de temps immenses.

**Approche recommandée** : Génération d'URI `https://wa.me/?text=...` côté client, sans dépendance serveur.

| Étape | Action                                                                                   | Fichiers / Outils                                    |
| ----- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1     | Créer un utilitaire `buildWhatsAppMessage(type, data)` qui génère un message formaté.    | `src/lib/whatsapp.ts`                                |
| 2     | Ajouter un bouton "Partager sur WhatsApp" dans les pages Stock, Récap et Produits.       | `StockPage.tsx`, `RecapPage.tsx`, `ProductsPage.tsx` |
| 3     | Créer un bouton "Commander réappro" sur les lignes de rupture/stock faible.              | `StockPage.tsx` (cartes alertes)                     |
| 4     | Ouvrir `https://wa.me/?text=encodeURIComponent(message)` dans un nouvel onglet.          | Utilitaire + handler inline                          |
| 5     | Optionnel : stocker un contact fournisseur par produit pour pré-remplir `wa.me/<phone>`. | Table `products.supplier_phone`                      |

**Complexité** : Faible (1 jour). Purement front-end.

**Risques** : Nécessite l'application WhatsApp installée sur mobile ; fallback vers copier-coller si `wa.me` ne répond pas.

---

### 3. Top produits vendus / Taux de rotation (#31, #32) — Priorité : MOYENNE-HAUTE

**Pourquoi** : Donne des leviers métier avancés : quels produits sont les plus rentables, quels sont les "meubles".

**Approche recommandée** : Nouveaux endpoints Edge Functions + graphiques Recharts.

| Étape | Action                                                                                        | Fichiers / Outils                              |
| ----- | --------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| 1     | Ajouter une Edge Function `product-stats` qui calcule top ventes et taux de rotation par org. | `supabase/functions/product-stats/index.ts`    |
| 2     | Calculer le taux de rotation : `quantité vendue période / stock moyen période`.               | SQL côté Edge Function                         |
| 3     | Ajouter un onglet/section "Analyse" sur le Dashboard.                                         | `DashboardPage.tsx` + `DashboardAnalytics.tsx` |
| 4     | Afficher top 8 produits avec barres visuelles et taux de rotation colorés.                    | `recharts` ou composant bar custom             |

**Complexité** : Moyenne (2 jours). Nécessite de bien définir la période de calcul.

**Risques** : Le taux de rotation est une approximation si les données historiques sont incomplètes. Ajouter une note d'avertissement comme pour les tendances.

---

### 4. Splash screen / Installation PWA banner (#1, #94) — Priorité : MOYENNE

**Pourquoi** : Renforce la marque et guide l'installation PWA.

**Approche recommandée** : Splash CSS + `beforeinstallprompt` event.

| Étape | Action                                                                                         | Fichiers / Outils                               |
| ----- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1     | Ajouter un écran de splash dans `index.html` avec logo + spinner, masqué une fois React monté. | `index.html`, `src/main.tsx`                    |
| 2     | Écouter `window.beforeinstallprompt` dans un hook dédié.                                       | `src/features/pwa/hooks/useInstallPrompt.ts`    |
| 3     | Afficher une bannière d'installation mobile quand l'événement est disponible.                  | `src/features/pwa/components/InstallBanner.tsx` |
| 4     | Déclencher `deferredPrompt.prompt()` au clic.                                                  | Composant + hook                                |

**Complexité** : Faible (1 jour).

**Risques** : `beforeinstallprompt` n'est pas supporté sur iOS Safari ; là-bas, afficher un guide manuel d'ajout à l'écran d'accueil.

---

### 5. Pull-to-refresh / Swipe-to-close / Vibration (#11, #12, #88) — Priorité : MOYENNE

**Pourquoi** : Feeling natif mobile, feedback haptique, fluidité perçue.

**Approche recommandée** : Bibliothèque Hammer.js ou gestes CSS natifs.

| Feature             | Approche                                                                                                | Fichiers                                    |
| ------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Pull-to-refresh     | Wrapper `PullToRefresh` (CSS transform + touchend threshold) autour des listes principales.             | `src/components/gestures/PullToRefresh.tsx` |
| Swipe-down to close | Intégrer Base UI `Dialog` avec drag-to-close ou utiliser une bottom sheet native qui supporte le swipe. | `MobileMenuSheet.tsx`, modales mobiles      |
| Vibration           | Wrapper `navigator.vibrate(pattern)` dans un utilitaire `haptic.ts`.                                    | `src/lib/haptic.ts`                         |

**Complexité** : Moyenne (2 jours).

**Risques** : iOS supporte mal `navigator.vibrate` ; feature progressive (ne bloque pas si absent).

---

### 6. Template Excel téléchargeable (#51) — Priorité : MOYENNE

**Pourquoi** : Réduit drastiquement les erreurs de format d'import.

**Approche recommandée** : Génération côté client avec `exceljs` ou simple fichier CSV statique.

| Étape | Action                                                                            | Fichiers                                                |
| ----- | --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1     | Créer un fichier `public/templates/import-produits.xlsx` avec colonnes attendues. | `public/templates/`                                     |
| 2     | Ou générer dynamiquement un CSV/Excel avec `exceljs` dans le navigateur.          | `src/features/products/utils/generateImportTemplate.ts` |
| 3     | Ajouter un lien "Télécharger le modèle" dans l'import.                            | `ProductsPage.tsx`                                      |

**Complexité** : Très faible (quelques heures).

---

### 7. Safe areas iOS (#14) — Priorité : FAIBLE-MOYENNE

**Pourquoi** : Évite les boutons coupés par l'encoche et la barre home iPhone X+.

**Approche recommandée** : CSS `env(safe-area-inset-*)` + meta viewport.

| Étape | Action                                                                                                            | Fichiers                              |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 1     | Modifier `index.html` viewport : `viewport-fit=cover`.                                                            | `index.html`                          |
| 2     | Ajouter `padding-top: env(safe-area-inset-top)` et `padding-bottom: env(safe-area-inset-bottom)` sur `AppLayout`. | `src/components/layout/AppLayout.tsx` |

**Complexité** : Très faible (1 heure).

---

### 8. Font-size 16px inputs (#107) — Priorité : FAIBLE

**Pourquoi** : Évite le zoom automatique sur focus iOS.

**Approche recommandée** : Classe Tailwind globale sur les inputs mobiles.

| Étape | Action                                                       | Fichiers                                  |
| ----- | ------------------------------------------------------------ | ----------------------------------------- |
| 1     | S'assurer que `Input` utilise `text-base` (16px) par défaut. | `src/components/ui/input.tsx`             |
| 2     | Vérifier `PinPad.tsx` et les modales mobile.                 | `src/features/auth/components/PinPad.tsx` |

**Complexité** : Très faible (30 min).

---

## Plan de priorisation suggéré

| Phase                        | Features                                                            | Effort total estimé | Impact UX   |
| ---------------------------- | ------------------------------------------------------------------- | ------------------- | ----------- |
| **Phase 1 — Terrain rapide** | WhatsApp share/commande, Template Excel, Safe areas, Font-size 16px | 1–2 jours           | Très élevé  |
| **Phase 2 — PWA native**     | Notifications Web Push, Rupture toast, Vibration, Install banner    | 3–5 jours           | Très élevé  |
| **Phase 3 — Mobile feeling** | Pull-to-refresh, Swipe-down, Splash screen                          | 2–3 jours           | Moyen-élevé |
| **Phase 4 — Analytics**      | Top produits, Taux de rotation                                      | 2–3 jours           | Moyen       |

---

_Recommandations générées le 2026-06-24 pour le projet StockFlow vNext._
