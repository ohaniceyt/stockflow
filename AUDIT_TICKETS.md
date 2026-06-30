# Plan d'action — Tickets d'audit StockFlow vNext

> Généré le 23 juin 2026 à partir du rapport d'audit complet.
> Format prêt pour import GitHub Issues / Linear / GitLab / Notion.

---

## Légende

- **P0** = Bloquant production — corriger dans les 48h / 1 semaine
- **P1** = Haute priorité — sprint en cours
- **P2** = Moyenne priorité — sprint suivant
- **P3** = Amélioration / dette technique — backlog
- **Sévérité** : `CRITIQUE` / `HAUT` / `MOYEN` / `FAIBLE`

---

## Phase 1 — Sécurité & conformité (0-2 semaines)

### SF-001 — Roter les clés Supabase et retirer `.env` / `.env.local` de l'historique git

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / DevOps
- **Description**: Les fichiers `.env` et `.env.local` contiennent la clé anon Supabase, le token Vercel OIDC et d'autres secrets. Ils sont actuellement présents dans l'historique local.
- **Fichiers concernés**: `.env`, `.env.local`, `.gitignore`
- **Critères d'acceptation**:
  - [ ] Roter la clé anon Supabase côté dashboard Supabase.
  - [ ] Roter le token Vercel OIDC.
  - [ ] Purger `.env` et `.env.local` de l'historique git (`git filter-repo` ou BFG Repo-Cleaner).
  - [ ] Ajouter `.env*`, `*.local`, `.vercel` dans `.gitignore`.
  - [ ] Vérifier qu'aucun secret n'apparaît dans `git log -p`.
  - [ ] Documenter la gestion des secrets dans `README.md` (variables Vercel / Supabase Vault).
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Lead Dev / DevOps

---

### SF-002 — Corriger les failles XSS dans tous les templates email

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend
- **Description**: Les Edge Functions d'envoi d'email interpolent des variables utilisateur (nom d'organisation, numéro de reçu/document, email) sans échappement HTML.
- **Fichiers concernés**: `supabase/functions/send-receipt-email/index.ts`, `send-document-email`, `send-invoice-reminder`, `send-magic-link`, `request-pin-reset`
- **Critères d'acceptation**:
  - [ ] Identifier toutes les variables injectées dans des templates HTML.
  - [ ] Implémenter une fonction d'échappement HTML dans `_shared/`.
  - [ ] Échapper toutes les variables dynamiques dans les templates.
  - [ ] Ajouter un test unitaire Edge Function injectant `<script>alert(1)</script>` et vérifiant l'encodage.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-003 — Recalculer les totaux de vente côté serveur dans `complete_sale`

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend / Financial
- **Description**: L'Edge Function `complete-sale` accepte et insère `subtotal`, `tax`, `total` envoyés par le client sans recalcule serveur.
- **Fichiers concernés**: `supabase/functions/complete-sale/index.ts`, migration `00000000000049_complete_sale_transaction.sql`
- **Critères d'acceptation**:
  - [ ] Ignorer ou valider les totaux client par rapport aux prix DB.
  - [ ] Recalculer `subtotal`, `tax_amount`, `total` à partir des lignes de vente et des prix produits.
  - [ ] Rejeter la requête si l'écart dépasse un seuil (ex: 0.001).
  - [ ] Ajouter des tests unitaires/Edge Function couvrant la manipulation des totaux.
  - [ ] Loguer les rejets comme tentatives de fraude.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-004 — Corriger la vérification du mot de passe dans le challenge platform-admin

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend
- **Description**: Le challenge "platform-admin" ne vérifie pas réellement le mot de passe ; n'importe quel admin plateforme peut obtenir un token sudo et exécuter des actions sensibles.
- **Fichiers concernés**: `supabase/functions/create-platform-challenge/index.ts`, `supabase/functions/_shared/platform.ts`
- **Critères d'acceptation**:
  - [ ] Vérifier le hash du mot de passe admin via `bcrypt`/`argon2`.
  - [ ] Limiter le nombre de tentatives (rate-limit / lockout).
  - [ ] Expirer le challenge après usage ou après un délai court (5 min).
  - [ ] Loguer toute élévation dans `platform_audit_logs`.
  - [ ] Ajouter des tests de non-régression.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-005 — Protéger l'Edge Function `request-pin-reset`

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend / Auth
- **Description**: La fonction `request-pin-reset` est publique et permet de forcer `force_pin_change=true` + envoi de magic-link sans authentification.
- **Fichiers concernés**: `supabase/functions/request-pin-reset/index.ts`
- **Critères d'acceptation**:
  - [ ] Nécessiter une authentification valide (JWT) pour initier un reset PIN.
  - [ ] Vérifier que l'utilisateur authentifié correspond à l'utilisateur cible ou possède un droit explicite.
  - [ ] Ajouter rate-limit par utilisateur (max 3 demandes / heure).
  - [ ] Ne plus exposer `force_pin_change` via une route publique.
  - [ ] Ajouter tests Edge Function.
- **Estimation**: 5h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-006 — Restreindre ou supprimer `lookup-user-by-email`

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend
- **Description**: L'Edge Function expose nom, rôle, orgId, orgName à partir d'un email, permettant l'énumération d'utilisateurs.
- **Fichiers concernés**: `supabase/functions/lookup-user-by-email/index.ts`
- **Critères d'acceptation**:
  - [ ] Analyser tous les usages de cette fonction.
  - [ ] Soit supprimer la fonction, soit la rendre accessible uniquement authentifiée et avec droit explicite.
  - [ ] Ne jamais retourner `orgId`/`orgName` sans consentement.
  - [ ] Ajouter rate-limit et log d'audit.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-007 — Publier les pages légales `/privacy`, `/terms`, `/cookies`

- **Priorité**: P0
- **Sévérité**: HAUT
- **Domaine**: Compliance / Frontend
- **Description**: Le marketing affiche "RGPD-ready" mais il n'existe aucune page légale.
- **Fichiers concernés**: `src/features/marketing/pages/`, `src/components/layout/MarketingFooter.tsx`, `src/features/marketing/components/MarketingLink.tsx`
- **Critères d'acceptation**:
  - [ ] Créer `/privacy` avec finalités, durées de conservation, droits RGPD, DPO/contact.
  - [ ] Créer `/terms` avec CGU/CGV adaptées à la vente en ligne/caisse.
  - [ ] Créer `/cookies` avec liste des cookies et consentement.
  - [ ] Ajouter les liens dans le footer marketing et le footer app.
  - [ ] Mentionner le DPO et l'email de contact dans le marketing.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev / Legal

---

### SF-008 — Rendre `send-auto-reminders` fail-closed

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend
- **Description**: Si `AUTO_REMINDER_SECRET` est absent, la route devient publique et exécutable par n'importe qui.
- **Fichiers concernés**: `supabase/functions/send-auto-reminders/index.ts`
- **Critères d'acceptation**:
  - [ ] Si le secret est manquant, retourner 401 et ne pas exécuter.
  - [ ] Valider le secret de manière constant-time.
  - [ ] Ajouter un test unitaire couvrant l'absence de secret.
  - [ ] Documenter la variable requise dans le déploiement.
- **Estimation**: 2h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-009 — Supprimer ou isoler le seed démo dangereux

- **Priorité**: P0
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Backend
- **Description**: `supabase/seed.sql` contient un admin démo avec PIN `1234`. Si exécuté en production, cela donne un accès total.
- **Fichiers concernés**: `supabase/seed.sql`, migrations `00000000000004_seed.sql`, `00000000000014_demo_data.sql`
- **Critères d'acceptation**:
  - [ ] Identifier si le seed démo est exécuté automatiquement en prod.
  - [ ] Soit supprimer les comptes démo du seed, soit marquer le fichier comme `local-only`.
  - [ ] Forcer un mot de passe/PIN aléatoire fort si un compte démo doit exister en local.
  - [ ] Documenter comment initialiser un admin en prod via une commande sécurisée.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev / DevOps

---

## Phase 2 — Architecture & fiabilité (2-6 semaines)

### SF-010 — Retirer les tokens du `localStorage`

- **Priorité**: P1
- **Sévérité**: CRITIQUE
- **Domaine**: Security / Frontend
- **Description**: `accessToken`, `refreshToken` et `sudoTarget` sont stockés dans `localStorage`, vulnérables au XSS.
- **Fichiers concernés**: `src/features/auth/context/AuthContext.tsx`
- **Critères d'acceptation**:
  - [ ] Passer au stockage de session via cookies `httpOnly`/`Secure`/`SameSite=Lax` côté SSR, OU
  - [ ] Utiliser Supabase SSR (`@supabase/ssr`) avec cookie-based auth.
  - [ ] Retirer toute lecture/écriture de tokens dans `localStorage`.
  - [ ] Vérifier que le refresh fonctionne sans JS.
  - [ ] Adapter les tests E2E.
- **Estimation**: 12h
- **Dépendances**: Aucune
- **Assigné à**: Lead Frontend / Backend Dev

---

### SF-011 — Ajouter du rate-limit sur signup et API gateway

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / Backend
- **Description**: Le signup et l'API gateway n'ont pas de rate-limit, exposant l'app au spam et brute-force.
- **Fichiers concernés**: `supabase/functions/signup/index.ts`, `supabase/functions/api-gateway/index.ts`
- **Critères d'acceptation**:
  - [ ] Implémenter rate-limit IP-based ou email-based (ex: 5 signups / heure / IP).
  - [ ] Implémenter rate-limit global sur api-gateway.
  - [ ] Retourner 429 avec header `Retry-After`.
  - [ ] Tests de non-régression.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-012 — Ajouter du rate-limit sur `create-storefront-order`

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / Backend
- **Description**: La création de commande storefront est publique et n'a pas de rate-limit.
- **Fichiers concernés**: `supabase/functions/create-storefront-order/index.ts`
- **Critères d'acceptation**:
  - [ ] Limiter les commandes par IP (ex: 10/min).
  - [ ] Limiter les commandes par email/phone.
  - [ ] Tests de non-régression.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-013 — Écrire dans `activity_logs` et `login_attempts`

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / Compliance / Backend
- **Description**: Les tables `activity_logs` et `login_attempts` existent mais ne sont jamais écrites.
- **Fichiers concernés**: Schéma DB, Edge Functions d'auth, sign-in/sign-up
- **Critères d'acceptation**:
  - [ ] Logger tout login success/échec dans `login_attempts`.
  - [ ] Logger les actions sensibles (création user, reset PIN, challenge admin, vente) dans `activity_logs`.
  - [ ] Définir une politique de rétention (ex: 90 jours).
  - [ ] Ajouter un index sur `created_at` et `organization_id`.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-014 — Corriger l'ordre des migrations Supabase

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Backend / DevOps
- **Description**: L'ordre des migrations est cassé ou ambigu, ce qui peut provoquer des échecs sur de nouveaux environnements.
- **Fichiers concernés**: `supabase/migrations/`
- **Critères d'acceptation**:
  - [ ] Lister toutes les migrations et vérifier leur ordre chronologique.
  - [ ] Corriger les timestamps si nécessaire.
  - [ ] Tester un déploiement frais (`supabase db reset`).
  - [ ] Documenter la convention de nommage.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev / DevOps

---

### SF-015 — Ajouter CSP et security headers

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / DevOps
- **Description**: Aucune Content Security Policy ni security headers ne sont configurés.
- **Fichiers concernés**: `vercel.json`, `index.html`
- **Critères d'acceptation**:
  - [ ] Configurer CSP dans `vercel.json` (script-src, style-src, connect-src, img-src, frame-ancestors).
  - [ ] Ajouter `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`.
  - [ ] Tester avec `securityheaders.com`.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: DevOps / Frontend Dev

---

### SF-016 — Implémenter un Error Boundary global

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Frontend / UX
- **Description**: L'application n'a pas d'Error Boundary global ; une erreur React peut crasher toute l'app.
- **Fichiers concernés**: `src/App.tsx`, `src/components/`
- **Critères d'acceptation**:
  - [ ] Créer un `<ErrorBoundary>` global au-dessus du routing.
  - [ ] Afficher une UI de fallback avec bouton "Recharger" et "Signaler".
  - [ ] Capturer l'erreur vers Sentry (voir SF-030).
  - [ ] Ajouter des Error Boundaries par feature si pertinent.
- **Estimation**: 4h
- **Dépendances**: SF-030 (optionnel)
- **Assigné à**: Frontend Dev

---

### SF-017 — Implémenter le service worker PWA

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Frontend / Mobile
- **Description**: Le manifest PWA existe mais il n'y a aucun service worker. L'app ne fonctionne pas offline.
- **Fichiers concernés**: `public/manifest.json`, `vite.config.ts`
- **Critères d'acceptation**:
  - [ ] Ajouter `vite-plugin-pwa` ou Workbox.
  - [ ] Cacher le shell app et les assets statiques.
  - [ ] Gérer le fallback offline.
  - [ ] Fournir des icônes PNG au lieu de SVG seuls (voir SF-018).
- **Estimation**: 8h
- **Dépendances**: SF-018
- **Assigné à**: Frontend Dev

---

### SF-018 — Ajouter des icônes PNG au manifest PWA

- **Priorité**: P1
- **Sévérité**: MOYEN
- **Domaine**: Frontend / Mobile
- **Description**: Le manifest ne référence probablement que des SVG ; les stores/PWA nécessitent des PNG de tailles spécifiques.
- **Fichiers concernés**: `public/manifest.json`, `public/icons/`
- **Critères d'acceptation**:
  - [ ] Générer les icônes 192x192, 512x512, 1024x1024 en PNG.
  - [ ] Mettre à jour le manifest avec les bonnes tailles et `purpose`.
  - [ ] Vérifier avec Lighthouse PWA audit.
- **Estimation**: 3h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev / Design

---

### SF-019 — Restreindre le service-role aux opérations impossibles en RLS

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / Backend
- **Description**: Les Edge Functions utilisent massivement `service_role` ce qui bypass RLS.
- **Fichiers concernés**: Tous les `supabase/functions/*/index.ts`
- **Critères d'acceptation**:
  - [ ] Auditer chaque usage de `service_role`.
  - [ ] Remplacer par un client authentifié (`auth.getUser()`) quand c'est possible.
  - [ ] Documenter les rares cas légitimes d'utilisation de service-role.
  - [ ] Ajouter des commentaires justifiant chaque usage restant.
- **Estimation**: 10h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

### SF-020 — Renforcer les policies RLS trop permissives

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / Backend
- **Description**: Certaines tables ont des policies RLS absentes ou trop permissives.
- **Fichiers concernés**: `supabase/migrations/`
- **Critères d'acceptation**:
  - [ ] Auditer toutes les tables et policies existantes.
  - [ ] Vérifier que chaque table sensible a au moins une policy SELECT/INSERT/UPDATE/DELETE restrictive par org et rôle.
  - [ ] Ajouter des migrations de correction.
  - [ ] Ajouter des tests de non-régression.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: Backend Dev

---

## Phase 3 — UX & croissance (6-10 semaines)

### SF-021 — Créer un wizard first-sale post-onboarding

- **Priorité**: P2
- **Sévérité**: HAUT
- **Domaine**: UX / Frontend
- **Description**: Le dashboard est vide après l'onboarding, ce qui crée de la friction et réduit l'activation.
- **Fichiers concernés**: `src/features/dashboard/pages/DashboardPage.tsx`, `src/features/onboarding/`
- **Critères d'acceptation**:
  - [ ] Détecter un utilisateur sans vente.
  - [ ] Afficher un wizard guidé (créer produit → stock → première vente).
  - [ ] Tracker l'achèvement avec un flag utilisateur.
  - [ ] Permettre de skipper le wizard.
- **Estimation**: 10h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev / UX

---

### SF-022 — Implémenter un système de toast/notification global

- **Priorité**: P2
- **Sévérité**: HAUT
- **Domaine**: UX / Frontend
- **Description**: Aucun toast/snackbar global n'existe ; les messages de succès/erreur sont dispersés et parfois manqués.
- **Fichiers concernés**: `src/components/`, `src/App.tsx`
- **Critères d'acceptation**:
  - [ ] Créer un provider `ToastProvider` avec API `toast.success()`, `toast.error()`, `toast.info()`.
  - [ ] Support mobile-safe (bottom sheet ou top safe area).
  - [ ] Remplacer tous les `console.error` et `alert` inline par des toasts.
  - [ ] Accessibilité : annonces `aria-live="polite"`.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev

---

### SF-023 — Activer la caisse par défaut ou permettre l'activation depuis la page Caisse

- **Priorité**: P2
- **Sévérité**: HAUT
- **Domaine**: UX / Frontend / Backend
- **Description**: La caisse est désactivée par défaut, créant de la confusion pour les nouveaux utilisateurs.
- **Fichiers concernés**: `src/features/cashier/`, `src/features/settings/pages/OrganizationPage.tsx`
- **Critères d'acceptation**:
  - [ ] Soit activer `has_cashier_enabled` par défaut à la création org, soit
  - [ ] Afficher un CTA d'activation clair dans la page Caisse.
  - [ ] Guide contextuel lors de la première ouverture.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev

---

### SF-024 — Corriger le mismatch SettingsTabs / Store

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: UX / Frontend
- **Description**: Les onglets de paramètres ne reflètent pas toujours la section Store / Organisation attendue.
- **Fichiers concernés**: `src/features/settings/components/SettingsTabs.tsx`
- **Critères d'acceptation**:
  - [ ] Aligner les labels, les routes et les sections actives.
  - [ ] Vérifier que le tab actuel est souligné sur mobile et desktop.
  - [ ] Tests visuels E2E.
- **Estimation**: 3h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev

---

### SF-025 — Améliorer l'accessibilité du menu marketing

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: Accessibility / Frontend
- **Description**: Le menu marketing utilise `<details>` mal géré, manque skip link, contrastes à revoir.
- **Fichiers concernés**: `src/features/marketing/components/MarketingHeader.tsx`
- **Critères d'acceptation**:
  - [ ] Remplacer `<details>` par un menu accessible (ARIA `menu`, `menuitem`).
  - [ ] Ajouter un skip link.
  - [ ] Vérifier les contrastes WCAG AA sur tous les états.
  - [ ] Tester au clavier et avec lecteur d'écran.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev

---

### SF-026 — Remplacer les témoignages fictifs par des vrais cas clients

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: UX / Marketing
- **Description**: Les témoignages et avis affichés sont des placeholders fictifs.
- **Fichiers concernés**: `src/features/marketing/components/SocialProof.tsx`
- **Critères d'acceptation**:
  - [ ] Collecter 3-5 témoignages réels (texte + photo + nom + rôle).
  - [ ] Mettre à jour le composant SocialProof.
  - [ ] Si témoignages non disponibles, ajouter une mention "Avis de nos beta testeurs" ou cacher la section.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Product / Marketing

---

### SF-027 — Uniformiser le copywriting FR/EN

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: UX / Frontend
- **Description**: Mélange de français et d'anglais ("Dashboard" vs "Tableau de bord"), Caisse/POS ambigu.
- **Fichiers concernés**: Tous les composants UI
- **Critères d'acceptation**:
  - [ ] Créer un glossaire des termes en français.
  - [ ] Renommer "Dashboard" → "Tableau de bord" si cible FR.
  - [ ] Uniformiser Caisse vs POS → "Caisse".
  - [ ] Passer une revue linguistique.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev / Product

---

### SF-028 — Ajuster les tarifs et devise pour le marché cible

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: UX / Marketing / Product
- **Description**: Les tarifs sont en € alors que la cible semble être en XOF (Afrique francophone).
- **Fichiers concernés**: `src/features/marketing/pages/PricingPage.tsx`
- **Critères d'acceptation**:
  - [ ] Décider de la devise par défaut (XOF vs €).
  - [ ] Afficher les prix dans la devise cible.
  - [ ] Ajuster les paliers si nécessaire.
- **Estimation**: 3h
- **Dépendances**: Aucune
- **Assigné à**: Product / Frontend Dev

---

## Phase 4 — Opérations & qualité (10-14 semaines)

### SF-029 — Bloquer le déploiement si les tests E2E échouent

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: DevOps / QA
- **Description**: Les tests E2E sont en `continue-on-error`, donc un échec ne bloque pas le merge.
- **Fichiers concernés**: `.github/workflows/ci.yml`
- **Critères d'acceptation**:
  - [ ] Retirer `continue-on-error`.
  - [ ] Soit stabiliser les E2E, soit créer un job de "smoke tests" bloquant.
  - [ ] S'assurer que les tests E2E tournent dans la CI.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: DevOps / QA

---

### SF-030 — Ajouter Sentry et error tracking

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: DevOps / Frontend / Backend
- **Description**: Aucun outil de monitoring d'erreurs n'est en place.
- **Fichiers concernés**: `src/main.tsx`, `src/App.tsx`, Edge Functions
- **Critères d'acceptation**:
  - [ ] Configurer Sentry côté frontend (DSN en variable d'env, pas dans le code).
  - [ ] Configurer Sentry côté Edge Functions.
  - [ ] Capturer les erreurs non gérées.
  - [ ] Filtrer les PII avant envoi.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: DevOps / Backend Dev

---

### SF-031 — Ajouter un health check et des logs structurés

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: DevOps / Backend
- **Description**: Pas de health check ni de logs structurés.
- **Fichiers concernés**: `supabase/functions/health/`, Edge Functions
- **Critères d'acceptation**:
  - [ ] Créer une Edge Function `/health` vérifiant DB, Auth, storage.
  - [ ] Uniformiser les logs en JSON.
  - [ ] Configurer Vercel / Supabase pour exposer le health check.
- **Estimation**: 5h
- **Dépendances**: Aucune
- **Assigné à**: DevOps / Backend Dev

---

### SF-032 — Ajouter le monitoring Web Vitals (RUM)

- **Priorité**: P1
- **Sévérité**: MOYEN
- **Domaine**: DevOps / Frontend
- **Description**: Pas de mesure de performance réelle en production.
- **Fichiers concernés**: `src/main.tsx`
- **Critères d'acceptation**:
  - [ ] Envoyer LCP, INP, CLS vers Sentry / Vercel Analytics / custom endpoint.
  - [ ] Configurer des alertes sur les percentiles p75/p95.
  - [ ] Dashboard de suivi.
- **Estimation**: 4h
- **Dépendances**: SF-030
- **Assigné à**: DevOps / Frontend Dev

---

### SF-033 — Augmenter la couverture de tests

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: QA / Frontend / Backend
- **Description**: Seulement 9 tests Vitest, 0 test Edge Function.
- **Fichiers concernés**: `tests/`, Edge Functions
- **Critères d'acceptation**:
  - [ ] Ajouter `@vitest/coverage-v8`.
  - [ ] Définir un seuil minimal (ex: 60% lignes critiques).
  - [ ] Écrire des tests pour `AuthContext`, `complete-sale`, `create-platform-challenge`, `organizationService`.
  - [ ] Écrire des tests pour les Edge Functions critiques.
  - [ ] Intégrer la couverture dans la CI.
- **Estimation**: 20h
- **Dépendances**: Aucune
- **Assigné à**: QA / Backend Dev / Frontend Dev

---

### SF-034 — Résoudre les vulnérabilités `npm audit`

- **Priorité**: P1
- **Sévérité**: HAUT
- **Domaine**: Security / DevOps
- **Description**: `npm audit` rapporte 22 vulnérabilités high et 19 packages outdated.
- **Fichiers concernés**: `package.json`, `package-lock.json`
- **Critères d'acceptation**:
  - [ ] Lancer `npm audit` et catégoriser.
  - [ ] Commencer par mettre à jour `vercel` et les dépendances avec vulnérabilités known.
  - [ ] Mettre à jour les dépendances outdated non-breaking.
  - [ ] Vérifier que le build et les tests passent après chaque mise à jour.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: DevOps / Frontend Dev

---

### SF-035 — Configurer Dependabot / Renovate

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: DevOps
- **Description**: Pas de Dependabot configuré pour suivre les mises à jour de sécurité.
- **Fichiers concernés**: `.github/dependabot.yml`
- **Critères d'acceptation**:
  - [ ] Créer `dependabot.yml` pour npm hebdomadaire.
  - [ ] Configurer les groupes de mises à jour.
  - [ ] Limiter aux patchs/minors automatiques, majors manuelles.
- **Estimation**: 2h
- **Dépendances**: Aucune
- **Assigné à**: DevOps

---

### SF-036 — Configurer Husky + lint-staged

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: DevOps / Frontend
- **Description**: Husky est listé dans les dépendances mais inactif ; pas de pre-commit hooks.
- **Fichiers concernés**: `.husky/`, `package.json`
- **Critères d'acceptation**:
  - [ ] Initialiser Husky v9+.
  - [ ] Configurer `lint-staged` pour lint + typecheck + format.
  - [ ] Vérifier que le pre-commit bloke si erreur.
- **Estimation**: 3h
- **Dépendances**: Aucune
- **Assigné à**: DevOps / Frontend Dev

---

### SF-037 — Mettre en place un environnement de staging

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: DevOps
- **Description**: Pas d'environnement de staging/preview dédié.
- **Fichiers concernés**: Vercel, Supabase
- **Critères d'acceptation**:
  - [ ] Créer un projet Vercel preview par branche.
  - [ ] Créer une DB Supabase de staging.
  - [ ] Documenter le flux de déploiement staging → prod.
  - [ ] S'assurer que les secrets de staging sont isolés.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: DevOps

---

### SF-038 — Ajouter un `.nvmrc`

- **Priorité**: P3
- **Sévérité**: FAIBLE
- **Domaine**: DevOps / DX
- **Description**: Pas de version Node.js verrouillée.
- **Fichiers concernés**: `.nvmrc`
- **Critères d'acceptation**:
  - [ ] Créer `.nvmrc` avec la version LTS utilisée.
  - [ ] Documenter dans `README.md`.
- **Estimation**: 0.5h
- **Dépendances**: Aucune
- **Assigné à**: DevOps

---

### SF-039 — Améliorer la documentation développeur

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: DX / Documentation
- **Description**: README détaillé mais inline docs faibles, pas de CONTRIBUTING/CODEOWNERS.
- **Fichiers concernés**: `README.md`, `CONTRIBUTING.md`, `CODEOWNERS`
- **Critères d'acceptation**:
  - [ ] Créer `CONTRIBUTING.md` avec conventions de commit/PR.
  - [ ] Créer `CODEOWNERS`.
  - [ ] Améliorer les commentaires JSDoc dans les services critiques.
  - [ ] Documenter l'architecture offline-first et le flux auth.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Lead Dev

---

## Tickets transverses / Dette technique

### SF-040 — Refactoriser `AuthContext` monolithique

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: Frontend / Architecture
- **Description**: `AuthContext.tsx` fait 833 lignes et provoque des re-rendus inutiles de toute l'app.
- **Fichiers concernés**: `src/features/auth/context/AuthContext.tsx`
- **Critères d'acceptation**:
  - [ ] Extraire la logique d'auth dans des hooks/services dédiés.
  - [ ] Séparer `AuthProvider`, `OrganizationProvider`, `SudoProvider`.
  - [ ] Utiliser `React.useMemo`/`useCallback` pour éviter les re-rendus.
  - [ ] Tester le refactor.
- **Estimation**: 12h
- **Dépendances**: SF-010
- **Assigné à**: Lead Frontend

---

### SF-041 — Nettoyer les utilitaires CSS legacy

- **Priorité**: P3
- **Sévérité**: FAIBLE
- **Domaine**: Frontend / Design System
- **Description**: Des utilitaires CSS legacy cohabitent avec shadcn/ui.
- **Fichiers concernés**: `src/index.css`, composants legacy
- **Critères d'acceptation**:
  - [ ] Identifier les classes legacy non utilisées.
  - [ ] Migrer vers Tailwind ou shadcn.
  - [ ] Supprimer le code mort.
- **Estimation**: 8h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev

---

### SF-042 — Activer ou supprimer AppLock

- **Priorité**: P2
- **Sévérité**: HAUT
- **Domaine**: Security / Frontend
- **Description**: AppLock est actuellement désactivé (`APP_LOCK_ENABLED = false`) mais le code existe. C'est une fonctionnalité de sécurité inactive.
- **Fichiers concernés**: `src/features/auth/components/AppLock.tsx`, config
- **Critères d'acceptation**:
  - [ ] Décider : activer AppLock en production OU supprimer le code mort.
  - [ ] Si activé : forcer un PIN fort, limiter les tentatives, support déverrouillage admin.
  - [ ] Si supprimé : nettoyer toutes les références.
- **Estimation**: 6h
- **Dépendances**: Aucune
- **Assigné à**: Lead Frontend / Product

---

### SF-043 — Améliorer le offline sync (background sync + conflict resolution)

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: Frontend / Mobile
- **Description**: La sync Dexie + queue est robuste mais n'utilise pas Background Sync et ne gère pas bien les conflits.
- **Fichiers concernés**: `src/lib/offline/`, `src/features/sync/`
- **Critères d'acceptation**:
  - [ ] Implémenter Background Sync API.
  - [ ] Définir une stratégie de résolution de conflits (last-write-wins + logs).
  - [ ] Tester les scénarios offline/online.
- **Estimation**: 10h
- **Dépendances**: SF-017
- **Assigné à**: Frontend Dev

---

### SF-044 — Améliorer le bundle et réduire le chunk Excel 930 KB

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: Performance / Frontend
- **Description**: Un chunk lié à l'export/import Excel pèse 930 KB.
- **Fichiers concernés**: `vite.config.ts`, imports Excel
- **Critères d'acceptation**:
  - [ ] Analyser le bundle (`vite-bundle-analyzer`).
  - [ ] Lazy-loader la librairie Excel uniquement quand nécessaire.
  - [ ] Évaluer une alternative plus légère si pertinent.
- **Estimation**: 5h
- **Dépendances**: Aucune
- **Assigné à**: Frontend Dev

---

### SF-045 — Considérer la résidence des données / région africaine Supabase

- **Priorité**: P2
- **Sévérité**: MOYEN
- **Domaine**: Compliance / DevOps
- **Description**: Le pooler Supabase est en `eu-central-1`. Pour certains marchés africains, une résidence locale peut être requise.
- **Fichiers concernés**: Supabase project settings
- **Critères d'acceptation**:
  - [ ] Évaluer les exigences légales par pays cible.
  - [ ] Choisir une région adaptée si nécessaire.
  - [ ] Documenter la décision.
- **Estimation**: 4h
- **Dépendances**: Aucune
- **Assigné à**: Legal / DevOps

---

## Résumé exécutif

| Phase   | Période        | Nb tickets | Focus                                                |
| ------- | -------------- | ---------- | ---------------------------------------------------- |
| Phase 1 | 0-2 semaines   | 9          | Sécurité, conformité, secrets, corrections critiques |
| Phase 2 | 2-6 semaines   | 10         | Architecture, fiabilité, auth, PWA, RLS              |
| Phase 3 | 6-10 semaines  | 8          | UX, onboarding, notifications, accessibilité         |
| Phase 4 | 10-14 semaines | 11+        | Tests, monitoring, DevOps, dette technique           |

---

## Comment utiliser ce fichier

1. **GitHub Issues** : copier/coller chaque section dans un nouvel issue. Utiliser un script Python ou `gh issue create`.
2. **Linear** : importer via CSV ou utiliser l'API Linear.
3. **Notion / Trello** : importer le markdown ou transformer en CSV.
4. **Jira** : utiliser le format CSV ou l'API Jira.

Si tu veux, je peux générer un fichier JSON/CSV prêt à importer, ou pousser ces tickets directement vers GitHub Issues via `gh` si tu as configuré l'accès.
