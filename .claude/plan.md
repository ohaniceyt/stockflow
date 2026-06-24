# Plan : onboarding email/mot de passe + AppLock PIN

## Objectif
Refaire l’onboarding de zéro :
1. Inscription publique : **Nom, Email, Mot de passe, Numéro de téléphone**.
2. Email de vérification contenant un lien vers `/auth/verification` qui valide le compte.
3. Redirection vers `/login` pour saisir email + mot de passe (avec flow "mot de passe oublié").
4. Après connexion, accès au dashboard.
5. Dans le dashboard, demander de définir un **AppLock PIN**.
6. À terme, le PIN sert de déverrouillage rapide ; en cas d’oubli, un **OTP temporaire par email** permet de réinitialiser le PIN.

## Point de clarification nécessaire
Le terme "se loguer avec le PIN" peut être interprété de deux façons. Le choix conditionne l’architecture :

### Option A — PIN = deuxième identifiant serveur
- Le PIN (4-8 chiffres) est stocké hashé côté serveur dans `organization_memberships.pin_hash`.
- Sur la page `/login`, après la première connexion email/mot de passe, l’utilisateur peut ensuite saisir **Email + PIN** pour se reconnecter.
- L’Edge Function `login-with-pin` vérifie le PIN, puis récupère un token via Supabase Auth.
- **Avantage** : vraie connexion "PIN only" depuis n’importe quel appareil.
- **Inconvénient** : le PIN court devient un facteur unique de connexion serveur ; nécessite de générer une session sans mot de passe, ce qui oblige à détourner le modèle Supabase Auth.

### Option B — PIN = verrou local de l’application (AppLock) **(recommandée)**
- L’authentification reste email/mot de passe géré nativement par Supabase Auth.
- Le PIN sert à **verrouiller/déverrouiller l’application** sur l’appareil (session Supabase chiffrée localement avec une clé dérivée du PIN).
- Au premier dashboard, on demande de créer le PIN.
- Lors des ouvertures suivantes, si une session existe, on affiche un écran "Entrez votre PIN".
- "J’ai oublié mon PIN" envoie un **OTP/magic-link** par email ; une fois validé, l’AppLock est réinitialisé et on redemande un nouveau PIN.
- **Avantage** : architecture conforme à Supabase Auth, le PIN court ne remplace pas le mot de passe, meilleure sécurité, plus simple.
- **Inconvénient** : sur un nouvel appareil ou après déconnexion complète, l’utilisateur doit ressaisir email + mot de passe une fois.

## Implémentation (Option B)

### 1. Migrations Supabase
- `00000000000020_add_phone_and_optional_pin.sql`
  - `ALTER TABLE users ADD COLUMN phone TEXT;`
  - `ALTER TABLE organization_memberships ALTER COLUMN pin_hash DROP NOT NULL;`

### 2. Edge Functions
- **Refonte de `signup`**
  - Payload : `{ name, email, password, phone }`.
  - Crée l’utilisateur Supabase Auth (`email_confirm: false`).
  - Crée profil `users` + organisation "shell" + membership admin + subscription free.
  - Génère le lien de confirmation signup via `adminClient.auth.admin.generateLink({ type: 'signup', email, password, options: { redirectTo } })`.
  - Envoie l’email via Resend.
  - Retourne `{ success: true }`.
- **Création d’`initialize-session`**
  - Appelé après `signInWithPassword` ou après un magic-link OTP.
  - Charge `active_org_id`, membership, organisation.
  - Met à jour `last_login_at` et retourne le contexte métier.
- **Refonte de `change-pin`**
  - Devient "définir/modifier mon PIN" ; pas de `currentPin` requis si `pin_hash` est NULL.
- **Création de `request-pin-reset`**
  - Déclenche un magic-link vers `/auth/reset-pin` pour prouver l’identité avant de permettre un nouveau PIN.

### 3. Frontend
- `/signup` : Nom, Email, Mot de passe, Confirmation, Téléphone.
- `/auth/verification` : callback email signup → déconnecte et redirige `/login?verified=1`.
- `/login` : email + mot de passe ; liens "Mot de passe oublié ?" / "Lien magique".
- `/auth/forgot-password` : saisie email, appel `supabase.auth.resetPasswordForEmail`.
- `/auth/reset-password` : callback recovery → nouveau mot de passe → `/login`.
- `/dashboard` : si `pin_hash` est NULL, modale/bannière "Définir votre AppLock PIN".
- `AppLockScreen` : écran de verrouillage sur ouverture d’app.
- `/auth/set-pin` : création/modification du PIN.

### 4. AuthContext
- Gérer session Supabase native.
- Exposer `signUp`, `signInWithPassword`, `signOut`, `resetPassword`, `setPin`, `changePin`, `lockApp`, `unlockApp`, `requestPinResetOtp`.
- Gérer l’état `appLocked`.

### 5. Stockage local du PIN
- Dériver une clé PBKDF2 du PIN pour chiffrer un secret local.
- `localStorage` : `stockflow-session` (session Supabase) + `stockflow-lock` (secret chiffré).

### 6. Déploiement
- Migrations Supabase.
- Déploiement Edge Functions.
- Mise à jour `supabase/config.toml` si besoin.
- Build + déploiement Vercel.
- Smoke tests.
