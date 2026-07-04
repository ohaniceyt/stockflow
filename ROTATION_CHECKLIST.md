# Checklist exécutable — Rotation des secrets StockFlow vNext

> Date : 2026-06-23  
> Objectif : invalider tous les secrets historiquement exposés (`.env`, `.env.local`, scripts) et purger l'historique git.  
> Temps estimé : 20–40 min si les accès sont disponibles.  
> Risque : indisponibilité temporaire du front et des Edge Functions si les nouvelles clés ne sont pas synchronisées rapidement.

---

## Prérequis

- Accès **Supabase Dashboard** au projet `ngdvmodloxuvrdjjzxel`.
- Accès **Vercel Dashboard** au projet `stockflow`.
- Accès **Resend Dashboard**.
- Terminal avec `openssl`, `pip`/`git-filter-repo`, `git`.
- Le repo local est propre (`git status` vide).

---

## Phase 1 — Rotation Supabase (impact front + Edge Functions)

### 1.1 Anon key (frontend)

- [ ] Ouvrir https://supabase.com/dashboard/project/ngdvmodloxuvrdjjzxel/settings/api
- [ ] Dans **Project API keys** → clic sur **Reveal** à côté de `anon` → **Rotate anon key**.
- [ ] Copier la nouvelle clé `anon`.
- [ ] Ouvrir https://vercel.com/stockflowtg/stockflow/environment-variables
- [ ] Mettre à jour `VITE_SUPABASE_ANON_KEY` avec la nouvelle clé.
- [x] `VITE_SUPABASE_PUBLISHABLE_KEY` a été retiré de `src/services/supabase.ts`, `.env.example`, `README.md` et la CI.

### 1.2 Service role key (Edge Functions)

- [ ] Dans Supabase Dashboard > **Project API keys** → clic sur **Reveal** à côté de `service_role` → **Rotate service_role key**.
- [ ] Copier la nouvelle clé `service_role`.
- [ ] Mettre à jour `SUPABASE_SERVICE_ROLE_KEY` dans les **Supabase Edge Functions secrets** :
  ```bash
  npx supabase@2.109.0 secrets set SUPABASE_SERVICE_ROLE_KEY="nouvelle-cle" --project-ref ngdvmodloxuvrdjjzxel
  ```
- [ ] Vérifier que la variable existe bien :
  ```bash
  npx supabase@2.109.0 secrets list --project-ref ngdvmodloxuvrdjjzxel
  ```

> **⚠️ Point de vigilance** : la rotation de `service_role` rend toutes les Edge Functions temporairement inopérantes jusqu'à ce que le nouveau secret soit propagé. Idéalement, faire 1.1 et 1.2 à la suite puis redéployer.

---

## Phase 2 — Rotation Resend (envoi d'emails)

- [ ] Ouvrir https://resend.com/api-keys
- [ ] Révoquer l'ancienne clé API.
- [ ] Créer une nouvelle clé avec les mêmes permissions (envoi uniquement).
- [ ] Mettre à jour `RESEND_API_KEY` dans les Supabase Edge Functions secrets :
  ```bash
  npx supabase@2.109.0 secrets set RESEND_API_KEY="re_..." --project-ref ngdvmodloxuvrdjjzxel
  ```

---

## Phase 3 — Rotation des secrets partagés

### 3.1 AUTO_REMINDER_SECRET

- [ ] Générer un secret fort :
  ```bash
  openssl rand -hex 32
  ```
- [ ] Le définir dans Supabase Edge Functions secrets :
  ```bash
  npx supabase@2.109.0 secrets set AUTO_REMINDER_SECRET="..." --project-ref ngdvmodloxuvrdjjzxel
  ```
- [ ] Mettre à jour le GitHub secret `CRON_SECRET` (même valeur ou différente selon la politique) :
      https://github.com/stockflowtg/stockflow/settings/secrets/actions → `CRON_SECRET`.

### 3.2 CRON_SECRET

- [ ] Si `CRON_SECRET` est différent de `AUTO_REMINDER_SECRET`, le regénérer de la même manière.
- [ ] Mettre à jour dans Supabase Edge Functions secrets et GitHub Actions secrets.

---

## Phase 4 — Renouvellement du mot de passe platform-admin

- [ ] Choisir un mot de passe fort (≥ 20 caractères, aléatoire).
- [ ] Récupérer la valeur actuelle de `SUPABASE_SERVICE_ROLE_KEY` (celle nouvellement tournée).
- [ ] Exécuter :
  ```bash
  cd /Users/macbook/Desktop/stockflow-vnext
  export SUPABASE_URL="https://ngdvmodloxuvrdjjzxel.supabase.co"
  export SUPABASE_SERVICE_ROLE_KEY="nouvelle-service-role-key"
  export PLATFORM_ADMIN_EMAIL="su@app.grandigix.com"
  export PLATFORM_ADMIN_PASSWORD="mot-de-passe-fort-à-choisir"
  node scripts/seed-admin.mjs
  ```
- [ ] Noter le **PIN** affiché et le stocker dans un gestionnaire de mots de passe.
- [ ] Tester immédiatement le challenge dans le back-office (action sensible → dialogue de mot de passe).

---

## Phase 5 — Redéploiement et validation

- [ ] Redéployer l'application Vercel pour prendre en compte la nouvelle `VITE_SUPABASE_ANON_KEY` :
  ```bash
  npx vercel --prod --yes
  ```
- [ ] Redéployer les Supabase Edge Functions (rechargement des secrets) :
  ```bash
  npx supabase@2.109.0 functions deploy --project-ref ngdvmodloxuvrdjjzxel
  ```
- [ ] Lancer un smoke test public :
  ```bash
  export SUPABASE_PROJECT_REF="ngdvmodloxuvrdjjzxel"
  export SUPABASE_ANON_KEY="nouvelle-anon-key"
  export PUBLIC_APP_URL="https://stockflow.grandigix.com"
  node scripts/smoke-test-prod.mjs
  ```
- [ ] Lancer un smoke test authentifié (nécessite `SMOKE_EMAIL` / `SMOKE_PASSWORD`) :
  ```bash
  export SMOKE_EMAIL="..."
  export SMOKE_PASSWORD="..."
  node scripts/smoke-test-prod-authenticated.mjs
  ```
- [ ] Vérifier que le back-office platform-admin fonctionne (challenge + action sensible).

---

## Phase 6 — Vérifications post-rotation

- [ ] Aucun secret en clair dans le working tree :
  ```bash
  grep -R "eyJhbGci" src/ supabase/ scripts/ .github/
  # doit retourner vide
  ```
- [ ] Seul `.env.example` est tracké :
  ```bash
  git ls-files | grep -E '^\.env'
  ```
- [ ] Le build passe :
  ```bash
  npm run lint && npm run build
  ```

---

## Phase 7 — Purge de l'historique git (optionnel mais recommandé)

> **⚠️ Danger :** réécrit l'historique public. Tous les collaborateurs devront recloner.

- [ ] S'assurer que toutes les clés ont été tournées (les anciennes valeurs seront inutilisables).
- [ ] Installer `git-filter-repo` :
  ```bash
  pip install git-filter-repo
  ```
- [ ] Purger `.env` et `.env.local` :
  ```bash
  git filter-repo \
    --path .env --path .env.local \
    --path-glob 'supabase/functions/**/.env' \
    --invert-paths
  ```
- [ ] Forcer le push :
  ```bash
  git push origin --force --all
  ```
- [ ] Demander aux collaborateurs de recloner le repo.

### Si vous voulez aller plus loin

Les anciens scripts contenaient des JWT en dur. Pour les retirer aussi de l'historique tout en gardant les fichiers actuels, utiliser `git filter-repo --replace-text` avec un fichier de remplacement (remplacer les JWT connus par `[REDACTED_JWT]`). La procédure exacte dépend des clés historiques.

---

## Phase 8 — Fermeture

- [ ] Marquer la tâche #375 comme terminée.
- [ ] Mettre à jour `SECURITY_ROTATION.md` et `SECRETS_MANAGEMENT_AUDIT.md` pour refléter que les rotations sont effectuées.
- [ ] Prévenir l'équipe du force-push éventuel.

---

## Liens rapides

| Service                   | URL                                                                      |
| ------------------------- | ------------------------------------------------------------------------ |
| Supabase project settings | https://supabase.com/dashboard/project/ngdvmodloxuvrdjjzxel/settings/api |
| Vercel env variables      | https://vercel.com/stockflowtg/stockflow/environment-variables           |
| Resend API keys           | https://resend.com/api-keys                                              |
| Vercel tokens             | https://vercel.com/account/tokens                                        |
| GitHub secrets            | https://github.com/stockflowtg/stockflow/settings/secrets/actions        |
