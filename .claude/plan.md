# Plan : refonte onboarding + correction boutons save/create

## Problèmes identifiés

### 1. Onboarding confus
- L'inscription publique crée **automatiquement** une organisation "shell" nommée "Mon organisation" dans l'Edge Function `signup`. L'utilisateur ne choisit jamais le nom de son org.
- Après vérification email + login, l'utilisateur atterrit sur `/dashboard` même si l'organisation n'est pas configurée (`onboardingCompleted === false`).
- La page `/onboarding` existe mais n'est pas automatiquement présentée.
- Si l'utilisateur est invité à rejoindre une organisation existante, le flux `/invite?token=...` fonctionne et le place directement dans l'org : il ne devrait **pas** être redirigé vers `/onboarding`.

### 2. Boutons "save / create" semblent inactifs
- Audit rapide : la plupart des `<form onSubmit={...}>` et des boutons `type="submit"` sont techniquement corrects.
- Le vrai problème : **l'erreur de mutation n'est pas affichée dans le dialogue** pour plusieurs formulaires. Quand l'Edge Function échoue (ex. quota, RLS, validation), le bouton reste apparemment "sans effet" car l'utilisateur ne voit pas le message d'erreur.
- Certains dialogs ferment seulement via `onSuccess`, mais n'affichent jamais `mutation.error`.

## Objectifs

1. **Signup sans org automatique** : la création de compte crée juste un profil global. La création d'organisation devient explicite pendant l'onboarding.
2. **Onboarding obligatoire** pour les nouveaux comptes non invités, avec redirection automatique après login.
3. **Invitation** : l'utilisateur invité rejoint l'org existante sans passer par `/onboarding`.
4. **Feedback d'erreur** visible dans tous les dialogs de création/édition afin que les boutons ne semblent plus "morts".

---

## Partie A — Refonte onboarding

### A.1 Edge Function `signup`

**Comportement actuel à changer :**
- Supprimer la création automatique de l'organisation, membership et subscription.
- Le signup crée uniquement :
  - l'utilisateur Supabase Auth (`email_confirm: false`)
  - le profil global dans `users` (`id`, `name`, `email`, `phone`, `email_verified: false`, `active_org_id: NULL`)

**Nouveau retour :**
```json
{ "success": true, "message": "Compte créé. Vérifiez votre email." }
```

### A.2 Edge Function `initialize-session`

**Comportement actuel :** retourne une erreur 403 "No organization found for this user" si `active_org_id` est NULL.

**Nouveau comportement :**
- Si le profil n'a pas d'`active_org_id` et aucun membership actif, retourner un flag explicite :
  ```json
  {
    "user": { ... },
    "membership": null,
    "organization": null,
    "onboardingCompleted": false,
    "needsOrganization": true
  }
  ```
- Le frontend utilisera ce flag pour rediriger vers `/onboarding`.

### A.3 Edge Function `complete-onboarding` (modifiée)

**Nouveau rôle :** créer l'organisation initiale si l'utilisateur n'en a pas.

**Logique :**
1. Vérifier le token JWT.
2. Si l'utilisateur a déjà un membership actif (invitation déjà acceptée, ou org existante) → refuser avec un message adapté.
3. Créer l'organisation :
   - `name`, `currency`, `timezone`, `onboarding_completed: true`
4. Créer le membership admin :
   - `org_id`, `user_id`, `role: 'admin'`, `is_active: true`
5. Créer la subscription `free` active.
6. Créer le location par défaut.
7. Mettre à jour `users.active_org_id`.
8. Retourner `{ success: true }`.

**Payload :**
```json
{
  "orgName": "Ma Boutique",
  "currency": "XOF",
  "timezone": "Africa/Abidjan",
  "defaultLocationName": "Dépôt principal"
}
```

### A.4 Frontend — `AuthContext`

**Modifications :**
- Accepter `membership: null` et `organization: null` dans la session construite par `buildSession`.
- Ajouter à `AuthSession` :
  - `needsOrganization: boolean`
- Adapter `isAuthenticated` pour qu'un utilisateur sans org soit quand même "authentifié" (session Supabase valide) mais avec un accès limité.
- Exposer un flag dérivé `needsOnboarding = session && !session.onboardingCompleted && session.needsOrganization`.

### A.5 Frontend — `RequireAuth`

**Nouvelle règle :**
- Si `session.needsOrganization === true` **et** l'utilisateur a le rôle admin (ou pas de membership encore), rediriger automatiquement vers `/onboarding`, sauf si la route actuelle est déjà `/onboarding`.
- Si l'utilisateur est invité (membership existant, org existante), ne pas rediriger.

### A.6 Frontend — `OnboardingPage`

**Modifications :**
- Utiliser `completeOnboarding` qui appelle `complete-onboarding`.
- Après succès, recharger la session via `initializeSession` ou un appel dédié, puis rediriger vers `/dashboard`.
- Ajouter un lien secondaire : "Vous avez reçu une invitation ? Rejoindre une organisation" qui renvoie vers `/invite` (ou saisie de token).

### A.7 Frontend — `SignupPage`

**Modifications mineures :**
- Conserver le formulaire actuel.
- Après succès, message inchangé : "Vérifiez votre email".
- Pas de mention d'organisation ici.

### A.8 Frontend — `InvitePage`

**Modifications :**
- Conserver le flux d'acceptation d'invitation.
- Après `signIn` suite à l'acceptation, `initialize-session` retournera un membership/org existants → pas de redirection `/onboarding`.

### A.9 Tests E2E

- Mettre à jour `tests/e2e/onboarding-option-b.spec.ts` :
  - signup
  - vérification email
  - login
  - redirection automatique vers `/onboarding`
  - remplissage org + location
  - arrivée sur `/dashboard`
  - définition PIN
- Ajouter un test d'invitation publique qui vérifie l'absence de `/onboarding`.

### A.10 Migration Supabase

Nouvelle migration `00000000000026_signup_no_auto_org.sql` :
- Aucun changement de schéma critique (les colonnes existantes suffisent).
- S'assurer que `organization_memberships.pin_hash` accepte NULL (déjà fait).
- Ajouter un index optionnel sur `users.active_org_id` si absent.

---

## Partie B — Correction des boutons save/create

### B.1 Affichage des erreurs de mutation

Pour chaque formulaire/dialog, s'assurer que `mutation.error` est affiché près du bouton submit :

- `src/features/products/pages/ProductsPage.tsx` ✅ déjà affiché pour produit, ajouter pour catégorie
- `src/features/contacts/pages/ContactsPage.tsx` — vérifier / ajouter
- `src/features/locations/pages/LocationsPage.tsx` ✅ déjà affiché
- `src/features/movements/pages/MovementsPage.tsx` — vérifier / ajouter
- `src/features/inventory/pages/InventoryPage.tsx` — vérifier / ajouter
- `src/features/team/pages/TeamPage.tsx` — vérifier / ajouter pour invitation / création utilisateur
- `src/features/products/components/BulkProductImport.tsx` ✅ déjà affiché via `result.errors`

### B.2 Vérification des handlers

Audit complet des boutons de type `submit` / `button` dans les formulaires pour confirmer qu'aucun n'est orphelin :

- `src/features/auth/pages/*.tsx` — login, signup, forgot/reset password, PIN pages : OK
- `src/features/products/components/ProductForm.tsx` — OK
- `src/features/products/components/CategoryForm.tsx` — OK
- `src/features/contacts/components/ContactForm.tsx` — OK
- `src/features/locations/components/LocationForm.tsx` — OK
- `src/features/movements/components/MovementForm.tsx` — OK
- `src/features/inventory/components/CreateSessionDialog.tsx` — OK
- `src/features/team/components/InviteUserDialog.tsx` — OK
- `src/features/team/components/InvitationForm.tsx` — OK

**Action corrective générale :** si un `mutation.error` survient, l'afficher dans le dialog et ne pas fermer le dialog avant `onSuccess`.

### B.3 Pattern de fermeture des dialogs

Standardiser :
```tsx
mutation.mutate(data, {
  onSuccess: () => {
    setIsOpen(false)
    resetForm()
  },
})
```
Ne pas fermer le dialog sur `onError`.

### B.4 Ajout de notifications/toasts optionnel

Si le projet n'a pas de système de toast, utiliser un simple `<p className="text-sm text-destructive">{error.message}</p>` dans chaque dialog de création/édition.

---

## Partie C — Déploiement

1. Créer / modifier les Edge Functions :
   - `supabase/functions/signup/index.ts`
   - `supabase/functions/initialize-session/index.ts`
   - `supabase/functions/complete-onboarding/index.ts`
2. Nouvelle migration Supabase.
3. Mettre à jour le frontend :
   - `AuthContext.tsx`
   - `RequireAuth.tsx`
   - `OnboardingPage.tsx`
   - `SignupPage.tsx`
   - pages de formulaires pour feedback d'erreur
4. `npm run lint`, `npm run build`, `npm run test`
5. `npx playwright test tests/e2e/onboarding-option-b.spec.ts tests/e2e/products.spec.ts tests/e2e/contacts.spec.ts tests/e2e/locations.spec.ts`
6. `npx supabase db push` + `npx supabase functions deploy`
7. Commit, push, deploy Vercel.

---

## Décisions à valider

1. **Validez-vous la séparation signup / création d'org ?** (signup = compte seul ; onboarding = org + location)
2. **Validez-vous que l'utilisateur invité évite `/onboarding` ?**
3. **Pour le feedback d'erreur :** simple message inline dans chaque dialog suffit, ou souhaitez-vous un système de toast global ?
4. **Le plan free reste-t-il la valeur par défaut pour la nouvelle org créée en onboarding ?**
