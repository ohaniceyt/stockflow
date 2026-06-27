# StockFlow vNext

Application de gestion de stock multi-utilisateur (MVP).

- **Frontend** : Vite + React 19 + TypeScript + Tailwind CSS v4
- **Backend / Auth** : Supabase (Postgres + Auth + Edge Functions)
- **Cache / Offline** : Dexie (IndexedDB) + TanStack Query
- **Email** : Resend (depuis les Edge Functions)
- **Hébergement** : Vercel (frontend), Supabase (BDD + Edge Functions)

---

## Démarrage local

```bash
npm install
npm run dev
```

Le serveur de développement démarre sur `http://localhost:5173`.

### Supabase local (optionnel)

```bash
npm run db:start   # démarre le stack local
npm run db:reset   # réinitialise la BDD avec les migrations et le seed
npm run db:stop    # arrête le stack local
```

---

## Variables d’environnement

Copiez `.env.example` vers `.env` et renseignez les valeurs.

### Frontend (Vercel)

| Variable                 | Description                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | URL du projet Supabase (ex. `https://<ref>.supabase.co`)                                      |
| `VITE_SUPABASE_ANON_KEY` | Clé anonyme/public du projet (anciennement `VITE_SUPABASE_PUBLISHABLE_KEY`, fallback accepté) |

> Vérifiez qu’il n’y a **pas d’espace parasite** au début des valeurs dans le dashboard Vercel.

### Edge Functions (Supabase Secrets)

Définies via `supabase secrets set` ou le dashboard Supabase :

| Secret                      | Description                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | URL du projet Supabase                                                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (admin)                                                                              |
| `SUPABASE_ANON_KEY`         | Clé anonyme utilisée par les Edge Functions pour vérifier les JWT utilisateur auprès de Supabase Auth |
| `RESEND_API_KEY`            | Clé API Resend (`re_...`)                                                                             |
| `RESEND_FROM_EMAIL`         | Expéditeur par défaut, ex. `StockFlow <team@updates.stockflow.grandigix.com>`                         |
| `PUBLIC_APP_URL`            | URL publique de l’application, ex. `https://stockflow.grandigix.com`                                  |
| `CRON_SECRET`               | Secret utilisé par le cron GitHub Actions pour appeler `cleanup-rate-limits`                          |

### CI/CD (GitHub Actions)

| Secret                  | Description                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN` | Token d’accès Supabase CLI (`sbp_...`)                                               |
| `SUPABASE_PROJECT_ID`   | Référence du projet (`<ref>` dans `https://<ref>.supabase.co`)                       |
| `SUPABASE_DB_PASSWORD`  | Mot de passe de la base de données du projet (disponible dans le dashboard Supabase) |

---

## Flux d’authentification

L’application utilise **Supabase Auth email/password** pour l’authentification. Le PIN n’est **pas** un mot de passe : c’est un verrouillage local optionnel (AppLock) stocké sur l’appareil de l’utilisateur.

### Inscription self-service

1. L’utilisateur renseigne nom, email, téléphone et mot de passe sur `/signup`.
2. L’Edge Function `signup` crée le compte Auth Supabase, l’org, la location et l’abonnement.
3. Un email de vérification est envoyé via Resend.
4. Après vérification, l’utilisateur se connecte avec email/mot de passe et termine l’onboarding.

### Création d’utilisateur par un admin

1. Un **admin** crée un membre via l’interface `Équipe`.
2. L’Edge Function `create-user` :
   - vérifie le JWT de l’admin ;
   - crée l’utilisateur Auth Supabase avec `email_confirm: true` ;
   - insère le profil dans `public.users` ;
   - crée le `organization_memberships` ;
   - envoie un email de bienvenue via Resend avec un **lien de définition de mot de passe**.
3. Le nouvel utilisateur définit son mot de passe, se connecte en email/password, puis configure un **PIN AppLock local** (optionnel) sur son appareil.

### Connexion

1. L’utilisateur saisit son **email** et son **mot de passe** sur `/login`.
2. `AuthContext` appelle `supabase.auth.signInWithPassword`.
3. L’Edge Function `initialize-session` retourne le membership, l’organisation et les droits.
4. Si un **PIN AppLock** a été défini sur l’appareil, une overlay de verrouillage apparaît au prochain lancement. Le PIN est stocké dans IndexedDB et n’est **pas** synchronisé entre appareils.

---

## Edge Functions

| Function                         | JWT requis  | Rôle                                                                            |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------- |
| `send-magic-link`                | ❌ (public) | Envoie un magic link, rate-limit par email/IP, vérifie `public.users` actif     |
| `lookup-user-by-email`           | ❌ (public) | Recherche minimaliste d’un utilisateur par email pour le flux email-first       |
| `signup`                         | ❌ (public) | Inscription self-service : org + location + admin + abonnement d’essai          |
| `create-user`                    | ✅          | Crée un utilisateur + envoie l’email de bienvenue (admin/super_admin)           |
| `initialize-session`             | ✅          | Résout org/membership/rôle après connexion Supabase Auth                        |
| `list-users`                     | ✅          | Liste les utilisateurs de l’organisation                                        |
| `change-pin`                     | ✅          | Changement du PIN AppLock (hash stocké côté membership — utilisé si besoin)     |
| `reset-pin`                      | ✅          | Réinitialisation forcée du PIN AppLock (admin)                                  |
| `request-pin-reset`              | ❌ (public) | Envoie un magic link pour déverrouiller l’appareil local                        |
| `complete-onboarding`            | ✅          | Finalise l’onboarding de l’organisation                                         |
| `org-limits`                     | ✅          | Retourne les quotas et l’utilisation courante de l’organisation                 |
| `platform-list-organizations`    | ✅          | Liste toutes les organisations (plateforme admin)                               |
| `platform-suspend-organization`  | ✅          | Suspend / réactive une organisation (plateforme admin)                          |
| `platform-set-organization-plan` | ✅          | Change le plan d’une organisation (plateforme admin)                            |
| `cleanup-rate-limits`            | ❌ (cron)   | Supprime les logs de rate-limit de plus de 7 jours (protégée par `CRON_SECRET`) |

> **Note :** la fonction `login` héritée du flux PIN-first n’est plus appelée par le frontend. Elle est conservée temporairement pour compatibilité mais doit être supprimée ou désactivée.

### Déploiement

```bash
# Migration BDD
npx supabase db push

# Toutes les fonctions (vérification JWT par défaut)
npx supabase functions deploy

# Fonctions publiques (pas de vérification JWT)
npx supabase functions deploy send-magic-link --no-verify-jwt
npx supabase functions deploy lookup-user-by-email --no-verify-jwt
npx supabase functions deploy signup --no-verify-jwt
npx supabase functions deploy request-pin-reset --no-verify-jwt
```

---

## Rate limiting / sécurité

- **Login** : max 5 échecs / utilisateur / 15 min, max 20 échecs / IP / 15 min. Table `login_attempts`.
- **Magic link** : max 3 demandes / email / 15 min, max 10 demandes / IP / 15 min. Table `magic_link_requests`.
- Les fonctions publiques ne fuient pas l’existence d’un email (réponse générique).

---

## Scripts utiles

```bash
npm run lint          # ESLint
npm run lint:fix      # ESLint --fix
npm run format        # Prettier
npm run test          # Vitest (unit)
npm run test:e2e      # Playwright
npm run build         # Build Vite
```

---

## Checklist production

- [ ] `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont renseignés dans Vercel (production + preview) sans espace parasite.
- [ ] Les secrets Supabase (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, etc.) sont définis.
- [ ] `SUPABASE_ANON_KEY` est configuré comme secret Supabase pour la vérification JWT dans les Edge Functions.
- [ ] Les Edge Functions publiques (`send-magic-link`, `lookup-user-by-email`, `signup`, `request-pin-reset`) sont bien déployées avec `--no-verify-jwt`.
- [ ] Les Edge Functions protégées sont déployées **avec** vérification JWT.
- [ ] La dernière migration (`npx supabase db push`) est appliquée.
- [ ] Les comptes de test temporaires sont désactivés/supprimés.
- [ ] Aucun ancien domaine (ex. `stockflow-ruby.vercel.app`) ne reste dans le code ni dans les configs.
- [ ] `npm run lint`, `npm run test` et `npm run build` passent.
- [ ] Smoke test réalisé : signup → vérification email → login → onboarding → création opérateur → email de bienvenue → définition mot de passe → login → AppLock PIN.
