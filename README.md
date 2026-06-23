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

| Secret                      | Description                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | URL du projet Supabase                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service role (admin)                                                                                |
| `SUPABASE_ANON_KEY`         | Clé anonyme (utilisée pour les comptes de démo, si `DEMO_BYPASS=true`)                                  |
| `RESEND_API_KEY`            | Clé API Resend (`re_...`)                                                                               |
| `RESEND_FROM_EMAIL`         | Expéditeur par défaut, ex. `StockFlow <team@updates.stockflow.grandigix.com>`                           |
| `PUBLIC_APP_URL`            | URL publique de l’application, ex. `https://stockflow.grandigix.com`                                    |
| `DEMO_BYPASS`               | `true` uniquement en dev pour contourner l’email OTP sur les comptes de démo. **Jamais en production.** |

---

## Flux d’invitation / création d’utilisateur

1. Un **admin** crée un opérateur via l’interface `Équipe`.
2. L’Edge Function `create-user` :
   - vérifie le JWT de l’admin ;
   - crée l’utilisateur Auth Supabase avec `email_confirm: true` (pas d’email de confirmation auto Supabase) ;
   - insère la ligne dans `public.users` avec un **PIN temporaire** ;
   - envoie un email de bienvenue via Resend avec le PIN temporaire et le lien de connexion.
3. Le nouvel utilisateur se connecte :
   - saisit son **PIN** sur la page de login ;
   - l’Edge Function `login` valide le PIN et retourne les infos utilisateur ;
   - un **magic link** est envoyé à son email (Edge Function `send-magic-link`) ;
   - l’utilisateur clique le lien, puis choisit/modifie son PIN définitif.

---

## Edge Functions

| Function              | JWT requis  | Rôle                                                                        |
| --------------------- | ----------- | --------------------------------------------------------------------------- |
| `login`               | ❌ (public) | Valide le PIN, rate-limit par user/IP, retourne l’utilisateur               |
| `send-magic-link`     | ❌ (public) | Envoie un magic link, rate-limit par email/IP, vérifie `public.users` actif |
| `create-user`         | ✅          | Crée un utilisateur + envoie l’email de bienvenue (admin/super_admin)       |
| `list-users`          | ✅          | Liste les utilisateurs de l’organisation                                    |
| `change-pin`          | ✅          | Changement de PIN par l’utilisateur                                         |
| `reset-pin`           | ✅          | Réinitialisation forcée du PIN (admin)                                      |
| `complete-onboarding` | ✅          | Finalise l’onboarding de l’organisation                                     |

### Déploiement

```bash
# Migration BDD
npx supabase db push

# Fonctions publiques (pas de vérification JWT)
npx supabase functions deploy login --no-verify-jwt
npx supabase functions deploy send-magic-link --no-verify-jwt

# Fonctions protégées (vérification JWT par défaut)
npx supabase functions deploy create-user
npx supabase functions deploy list-users
npx supabase functions deploy change-pin
npx supabase functions deploy reset-pin
npx supabase functions deploy complete-onboarding
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
- [ ] `DEMO_BYPASS` n’est **pas** défini à `true` en production.
- [ ] Les Edge Functions publiques (`login`, `send-magic-link`) sont bien déployées avec `--no-verify-jwt`.
- [ ] Les Edge Functions protégées sont déployées **avec** vérification JWT.
- [ ] La dernière migration (`npx supabase db push`) est appliquée.
- [ ] Les comptes de test temporaires sont désactivés/supprimés.
- [ ] Aucun ancien domaine (ex. `stockflow-ruby.vercel.app`) ne reste dans le code ni dans les configs.
- [ ] `npm run lint`, `npm run test` et `npm run build` passent.
- [ ] Smoke test réalisé : login admin → magic link → dashboard → création opérateur → email de bienvenue → login opérateur → changement PIN.
