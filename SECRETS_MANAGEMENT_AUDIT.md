# Audit sécurité — Gestion des secrets StockFlow vNext

> Date : 2026-06-23  
> Mise à jour : 2026-06-23 — scripts durs nettoyés, backup local supprimé, automatisations CI/Sentry ajoutées.  
> Scope : variables d'environnement, tokens, clés API, historique git, logs, stockage local, scripts de test/smoke, CI/CD, dérivation des secrets.

---

## 1. Résumé exécutif

Les secrets serveur (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, etc.) restent côté Edge Functions et ne sont jamais envoyés au navigateur. Les tokens utilisateur sont stockés en `sessionStorage`, les clés API sont hashées, et le mot de passe admin plateforme est dérivé avec PBKDF2.

L'audit a permis de corriger **les fuites critiques de secrets codés en dur dans les scripts** :

- `scripts/check-admin.mjs` — anciennement `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` + email admin en dur.
- `scripts/smoke-test-prod-authenticated.mjs` — anciennement `SUPABASE_PROJECT_REF` + `SUPABASE_ANON_KEY` en dur.
- `scripts/smoke-test-receipt.mjs` — idem.
- `scripts/verify-onboarding-prod.mjs` — idem.
- `scripts/smoke-test-invoicing.mjs` — idem.

Ces fichiers lisent désormais exclusivement les variables d'environnement.  
Les scripts `smoke-test-prod.mjs` et `test-initialize-session.mjs` étaient déjà basculés sur des variables d'environnement.

Le backup `/tmp/stockflow-env-backup/` a été supprimé.  
**Il reste néanmoins des actions manuelles P0 obligatoires avant production** : rotation des clés Supabase/Resend et purge de l'historique git.

---

## 2. Contrôles positifs

| Domaine                       | Observation                                                                                                                   | Preuve                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Secrets serveur               | `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `AUTO_REMINDER_SECRET`, `CRON_SECRET` ne sont lus que dans les Edge Functions. | `supabase/functions/*/index.ts`                    |
| Session utilisateur           | Tokens en `sessionStorage`, pas de rechargement depuis `localStorage`.                                                        | `src/services/authStorage.ts`, `AuthContext.tsx`   |
| Clés API                      | Hash SHA-256, retournées une seule fois en clair.                                                                             | `create-api-key/index.ts`, `api-gateway/index.ts`  |
| Mot de passe admin plateforme | PBKDF2-SHA256 100k itérations, sel, comparaison constante, verrouillage.                                                      | `_shared/platform.ts`, `create-platform-challenge` |
| Refresh-token rotation        | Activée dans `config.toml`.                                                                                                   | `supabase/config.toml`                             |
| Rate-limiting                 | Fonctions publiques sensibles protégées par rate-limit.                                                                       | `send-magic-link`, `signup`, `api-gateway`         |
| Rédaction des logs            | `logger.ts` masque mots de passe, tokens, JWT, emails, IPs.                                                                   | `supabase/functions/_shared/logger.ts`             |
| Sentry                        | `beforeSend` récursif masque PII/tokens.                                                                                      | `src/lib/sentry.ts`                                |
| Headers de sécurité           | CSP, HSTS, X-Frame-Options, etc. dans `vercel.json`.                                                                          | `vercel.json`                                      |
| Scan de secrets en CI         | Job `secrets` avec TruffleHog.                                                                                                | `.github/workflows/ci.yml`                         |

---

## 3. Secrets codés en dur — état après correction

| Fichier                                     | Ancien problème                                                                                             | Correctif appliqué                                                                              |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `scripts/check-admin.mjs`                   | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, email admin en dur.                                            | Lit `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PLATFORM_ADMIN_EMAIL` depuis l'environnement. |
| `scripts/smoke-test-prod-authenticated.mjs` | `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY` en dur.                                                         | Lit `SUPABASE_PROJECT_REF` et `SUPABASE_ANON_KEY`.                                              |
| `scripts/smoke-test-receipt.mjs`            | `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY` en dur.                                                         | Lit les variables d'environnement.                                                              |
| `scripts/verify-onboarding-prod.mjs`        | `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY` en dur.                                                         | Lit les variables d'environnement.                                                              |
| `scripts/smoke-test-invoicing.mjs`          | `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY` en dur.                                                         | Lit les variables d'environnement.                                                              |
| `scripts/smoke-test-prod.mjs`               | Déjà basculé sur `SUPABASE_PROJECT_REF` / `SUPABASE_ANON_KEY`.                                              | OK.                                                                                             |
| `scripts/test-initialize-session.mjs`       | Déjà basculé sur `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `PLATFORM_ADMIN_EMAIL` / `PLATFORM_ADMIN_PASSWORD`. | OK.                                                                                             |
| `scripts/seed-admin.mjs`                    | Déjà basculé sur les variables d'environnement ; génération de PIN via `crypto.randomInt`.                  | OK.                                                                                             |

> **Attention** : corriger les fichiers dans le working tree ne supprime pas les anciennes valeurs de l'historique git. Une purge (`git filter-repo`) reste nécessaire avant de publier le repo.

---

## 4. Variables d'environnement et exposition au navigateur

### Ce qui existe

**Frontend (Vite) :**

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (fallback `VITE_SUPABASE_PUBLISHABLE_KEY`)

**Edge Functions (Deno) :**

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `PUBLIC_APP_URL`, `AUTO_REMINDER_SECRET`, `CRON_SECRET`, `LOG_LEVEL`

### Risques résiduels

| #   | Sévérité | Problème                                                                              | Recommandation                                                                  |
| --- | -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| 4.1 | Faible   | `VITE_SUPABASE_PUBLISHABLE_KEY` est utilisé en fallback ; la CI l'expose globalement. | Uniformiser sur `VITE_SUPABASE_ANON_KEY` et limiter aux jobs qui en ont besoin. |
| 4.2 | Faible   | `VITE_SENTRY_DSN` n'est pas documenté dans `.env.example`.                            | **Corrigé** — `VITE_SENTRY_DSN` est désormais documenté.                        |
| 4.3 | Faible   | `cron-cleanup.yml` hardcode l'URL Supabase.                                           | **Corrigé** — l'URL est désormais lue depuis `secrets.SUPABASE_URL`.            |

---

## 5. Logging de secrets et PII

### Ce qui a été corrigé

| #   | Sévérité | Problème                                                              | Preuve                         | Correctif                                                                                           |
| --- | -------- | --------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------- |
| 5.1 | Moyen    | Le logger Edge Function loguait emails et IP en clair.                | `_shared/logger.ts`            | `sanitizeFields()` masque les clés sensibles et les JWT.                                            |
| 5.2 | Moyen    | `send-auto-reminders` renvoyait le `stack` au client en cas d'erreur. | `send-auto-reminders/index.ts` | Erreur interne loguée côté serveur uniquement ; le client reçoit `"Internal error"`.                |
| 5.3 | Moyen    | Sentry n'avait pas de `beforeSend` pour filtrer tokens/PII.           | `src/lib/sentry.ts`            | `beforeSend` récursif masque mots de passe, tokens, emails, clés API, JWT. `sendDefaultPii: false`. |

---

## 6. Historique git et backup local

### Risques

| #   | Sévérité     | Problème                                                                          | État                                                                                                         |
| --- | ------------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 6.1 | **Critique** | `/tmp/stockflow-env-backup/.env` et `.env.local` contenaient les anciens secrets. | **Corrigé** — dossier supprimé.                                                                              |
| 6.2 | **Critique** | Les scripts listés au §3 contenaient des secrets réels dans l'historique git.     | **Partiellement corrigé** — fichiers réécrits, mais l'historique git contient encore les anciennes versions. |
| 6.3 | Haut         | Aucun scan de secrets dans la CI.                                                 | **Corrigé** — job `secrets` avec `trufflesecurity/trufflehog@main` dans `.github/workflows/ci.yml`.          |

### Action requise

Purger l'historique git avant publication publique :

```bash
pip install git-filter-repo
git filter-repo --path .env --path .env.local --path-glob 'supabase/functions/**/.env' --invert-paths
git push origin --force --all
```

> **Avertissement** : `git filter-repo` réécrit l'historique public. Tous les collaborateurs doivent recloner.

---

## 7. Stockage, rotation et révocation

### Ce qui existe

- Refresh-token rotation activée.
- `SECURITY_ROTATION.md` documente la rotation manuelle.
- Clés API hashées et retournées une seule fois.

### Risques

| #   | Sévérité | Problème                                                                                     | Recommandation                                                                          |
| --- | -------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 7.1 | Faible   | Pas d'expiration automatique des clés API (`organization_api_keys`).                         | Ajouter une colonne `expires_at` optionnelle et bloquer les requêtes expirées.          |
| 7.2 | Faible   | `AUTO_REMINDER_SECRET` et `CRON_SECRET` sont des secrets partagés sans rotation automatique. | Documenter une rotation trimestrielle ; stocker les plus sensibles dans Supabase Vault. |
| 7.3 | Faible   | Pas de `last_used_at` ? (En fait mis à jour par `api-gateway`.)                              | Vérifier la mise à jour ; ajouter une alerte sur les clés inactives.                    |

---

## 8. Dérivation / hachage

### Ce qui existe

- PIN AppLock local : PBKDF2-SHA256 100k itérations, sel aléatoire.
- Mot de passe admin plateforme : PBKDF2-SHA256 100k itérations, comparaison constante.

### Risques

| #   | Sévérité | Problème                                                        | État                                        |
| --- | -------- | --------------------------------------------------------------- | ------------------------------------------- |
| 8.1 | Moyen    | `seed-admin.mjs` utilisait `Math.random()` pour générer le PIN. | **Corrigé** — utilise `crypto.randomInt()`. |
| 8.2 | Faible   | PIN AppLock : comparaison non en temps constant.                | À traiter si AppLock est réactivé.          |
| 8.3 | Faible   | Hash admin plateforme stocké sans pepper côté serveur.          | Considérer l'ajout d'un pepper serveur.     |

---

## 9. CI/CD et secrets GitHub

### Ce qui existe

- Les workflows GitHub Actions injectent les secrets via `${{ secrets.XXX }}`.
- Un job `secrets` scanne chaque PR/push avec TruffleHog.

### Risques

| #   | Sévérité | Problème                                                | Recommandation                         |
| --- | -------- | ------------------------------------------------------- | -------------------------------------- |
| 9.1 | Faible   | `VITE_SUPABASE_*` exposés au niveau global de `ci.yml`. | Les limiter aux jobs `build` et `e2e`. |
| 9.2 | Faible   | URL Supabase hardcodée dans `cron-cleanup.yml`.         | Utiliser `secrets.SUPABASE_URL`.       |

---

## 10. Headers et CSP

### Ce qui a été corrigé

| #    | Sévérité | Problème                                                      | Correctif                                                                                |
| ---- | -------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 10.1 | Faible   | `vercel.json` ne définissait pas `Strict-Transport-Security`. | HSTS ajouté : `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`. |
| 10.2 | Faible   | Source maps Vite potentiellement publiques.                   | À vérifier dans la configuration de build.                                               |

---

## 11. Plan d'action priorisé

### P0 — Immédiat (actions manuelles requises)

1. **Roter la clé anonyme Supabase** et mettre à jour `VITE_SUPABASE_ANON_KEY` dans Vercel.
2. **Roter la clé `service_role` Supabase** et mettre à jour `SUPABASE_SERVICE_ROLE_KEY` dans Supabase Vault / Vercel.
3. **Révoquer et regénérer la clé Resend** et mettre à jour `RESEND_API_KEY`.
4. **Regénérer `AUTO_REMINDER_SECRET`** (fort aléatoire) et mettre à jour le secret Edge + le cron.
5. **Forcer le changement du mot de passe** du compte `su@app.grandigix.com` (ou du `PLATFORM_ADMIN_EMAIL` configuré).
6. **Purger l'historique git** avec `git filter-repo` puis `git push --force`.

### P1 — Court terme

7. Uniformiser la CI sur `VITE_SUPABASE_ANON_KEY` (retirer `VITE_SUPABASE_PUBLISHABLE_KEY`).
8. ~~Externaliser `SUPABASE_URL` dans `cron-cleanup.yml`.~~ **Corrigé.**
9. ~~Documenter `VITE_SENTRY_DSN` dans `.env.example`.~~ **Corrigé.**
10. Ajouter une colonne `expires_at` sur `organization_api_keys`.
11. Documenter la rotation trimestrielle des secrets partagés.

### P2 — Moyen terme

12. Considérer un pepper serveur pour le hash admin plateforme.
13. Ajouter un rate-limit par clé API dans `api-gateway`.
14. Activer des alertes sur les clés API inactives.

---

## 12. Conclusion

La gestion des secrets de StockFlow vNext est **globalement solide** pour une application moderne : les secrets serveur restent côté Edge Functions, la session utilisateur est isolée, et les hashes sont corrects. Les correctifs automatisés du jour (scripts nettoyés, backup supprimé, Sentry, logger, HSTS, TruffleHog) réduisent significativement la surface d'attaque.

Les priorités absolues restantes sont **manuelles** : **rotation de toutes les clés Supabase/Resend, changement du mot de passe admin et purge définitive de l'historique git**. Tant que ces actions ne sont pas exécutées, les anciennes valeurs demeurent accessibles via l'historique local et doivent être considérées comme compromises.
