# Procédure de rotation des secrets — StockFlow vNext

> Date : 23 juin 2026
> Suite à l'audit de sécurité, les fichiers `.env` et `.env.local` ont été retirés du repo.

---

## Secrets concernés

1. **Supabase `anon` JWT key** — présente dans `.env` (`VITE_SUPABASE_ANON_KEY`).
2. **Vercel OIDC token** — présent dans `.env.local` (`VERCEL_OIDC_TOKEN`).
3. **Supabase `service_role` key** — utilisée côté Edge Functions (doit rester côté Supabase Vault / Vercel env).
4. **Resend API key** — utilisée côté Edge Functions.
5. **AUTO_REMINDER_SECRET** — utilisée par l'Edge Function `send-auto-reminders`.
6. **Platform admin password** — utilisée par `create-platform-challenge`.

---

## Actions immédiates à réaliser manuellement

### 1. Supabase anon key

1. Ouvrir [Supabase Dashboard](https://supabase.com/dashboard) > Project **ngdvmodloxuvrdjjzxel**.
2. Aller dans **Project Settings > API > Project API keys**.
3. Cliquer sur **Reveal** puis **Rotate anon key**.
4. Copier la nouvelle clé.
5. Dans Vercel : **Project Settings > Environment Variables** > mettre à jour `VITE_SUPABASE_ANON_KEY`.
6. Redéployer l'application.

### 2. Vercel OIDC token

1. Ouvrir [Vercel Tokens](https://vercel.com/account/tokens).
2. Révoquer le token précédemment exposé (voir `VERCEL_OIDC_TOKEN` dans le backup).
3. Créer un nouveau token OIDC si nécessaire, ou utiliser les variables d'environnement classiques de Vercel.
4. Ne plus stocker ce token dans un fichier local.

### 3. Supabase service_role key

1. Dans Supabase Dashboard, aller dans **Project Settings > API > Project API keys**.
2. Cliquer sur **Reveal** puis **Rotate service_role key**.
3. Mettre à jour la variable dans Supabase Vault / Vercel (`SUPABASE_SERVICE_ROLE_KEY`).

### 4. Resend API key

1. Ouvrir [Resend Dashboard](https://resend.com/api-keys).
2. Révoquer l'ancienne clé.
3. Créer une nouvelle clé.
4. Mettre à jour `RESEND_API_KEY` dans les variables d'environnement Supabase Edge Functions.

### 5. AUTO_REMINDER_SECRET

1. Générer une chaîne aléatoire forte :
   ```bash
   openssl rand -hex 32
   ```
2. Définir `AUTO_REMINDER_SECRET` dans les variables d'environnement Supabase Edge Functions.
3. Configurer le cron/job qui appelle `send-auto-reminders` avec `Authorization: Bearer <secret>`.

### 6. Platform admin password

1. Choisir un mot de passe fort (min. 20 caractères).
2. Exécuter le script de setup admin :
   ```bash
   PLATFORM_ADMIN_PASSWORD="votre-mot-de-passe-fort" node scripts/seed-admin.mjs $SUPABASE_SERVICE_ROLE_KEY
   ```
3. Le script affichera un PIN aléatoire. Le stocker dans un gestionnaire de mots de passe.

---

## Développement local

À la place de `.env` / `.env.local`, utiliser les variables d'environnement fournies par :

- **Vercel CLI** : `vercel env pull .env.local` (crée un fichier temporaire ignoré par git).
- **Supabase CLI** : `supabase secrets list` / `supabase secrets set`.

Ne jamais commiter de fichier `.env` ou `.env.local`.

---

## Vérifications

Après rotation, s'assurer que :

- [ ] Aucune ancienne clé n'est présente dans `git log -p`.
- [ ] `git ls-files | grep -E '^\.env'` ne retourne que `.env.example`.
- [ ] `grep -R "eyJhbGci" src/ supabase/ scripts/` ne retourne aucune clé réelle.
- [ ] Le build et les tests passent avec les nouvelles variables.

---

## Backup temporaire

Les anciens fichiers `.env` et `.env.local` ont été sauvegardés dans :

```
/tmp/stockflow-env-backup/
```

**Supprimez ce dossier une fois la rotation terminée.**
