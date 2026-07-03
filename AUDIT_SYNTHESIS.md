# Synthèse exécutive — Audit StockFlow vNext

> Date : 2026-06-23  
> Source : consolidation de `audit-report.html`, `AUDIT_TICKETS.md`, `analyse-comparative-features.md` et `SECURITY_ROTATION.md`.

---

## Verdict global

**Score : 5,5 / 10**

StockFlow vNext dispose d'une architecture moderne (React 19, Supabase, Vite, Tailwind v4, shadcn/ui) et d'une base mobile-first solide. Elle **n'est cependant pas prête à une production à grande échelle** sans corriger d'abord les failles de sécurité, les lacunes de conformité et l'opérabilité immature.

---

## Scores par domaine

| Domaine                   | Score    | État synthétique                                                                                                          |
| ------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**              | 7,3 / 10 | Architecture propre, mais tokens en `localStorage`, AppLock inactif, utilitaires CSS legacy résiduels, PWA inachevée.     |
| **Backend Supabase**      | 5,2 / 10 | Fonctionnel mais trop permissif : totaux clients trustés, challenge admin brisé, CORS/RLS à durcir.                       |
| **UI/UX & Parcours**      | 6,8 / 10 | Bonne base responsive, mais friction jusqu'à la première vente, copywriting incohérent, accessibilité marketing à revoir. |
| **Sécurité & Compliance** | 4,0 / 10 | Secrets exposés localement, pas de consentement RGPD, audit logs incomplets, résidence des données non maîtrisée.         |
| **Tests, DevOps & Ops**   | 4,3 / 10 | Build vert, mais couverture très faible, monitoring absent, E2E non bloquante historiquement.                             |

---

## Top 10 risques critiques

| #   | Risque                                                           | Sévérité | Fichier(s) clé                                     | Statut post-audit                                                                            |
| --- | ---------------------------------------------------------------- | -------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | Clés et tokens exposés localement (`.env`, `.env.local`)         | Critique | `.env`, `.env.local`                               | Fichiers retirés du working tree ; rotation manuelle documentée dans `SECURITY_ROTATION.md`. |
| 2   | `complete_sale` fait confiance aux totaux envoyés par le client  | Critique | `supabase/functions/complete-sale/index.ts`        | **Toujours à corriger** : recalcul serveur requis.                                           |
| 3   | Challenge "platform-admin" ne vérifie pas le mot de passe        | Critique | `create-platform-challenge/index.ts`               | Corrigé (SF-004).                                                                            |
| 4   | XSS dans les templates email                                     | Critique | `send-receipt-email`, `send-document-email`, etc.  | Corrigé (SF-002) avec échappement HTML.                                                      |
| 5   | `request-pin-reset` public non authentifié                       | Critique | `supabase/functions/request-pin-reset/index.ts`    | Corrigé (SF-005).                                                                            |
| 6   | `lookup-user-by-email` expose nom, rôle, orgId, orgName          | Critique | `supabase/functions/lookup-user-by-email/index.ts` | Restreint (SF-006).                                                                          |
| 7   | Session stockée dans `localStorage`                              | Critique | `src/features/auth/context/AuthContext.tsx`        | **Toujours à migrer** (cookies httpOnly / SSR).                                              |
| 8   | `send-auto-reminders` fail-open si `AUTO_REMINDER_SECRET` absent | Critique | `supabase/functions/send-auto-reminders/index.ts`  | Corrigé (SF-008).                                                                            |
| 9   | Seed contenant admin démo avec PIN `1234`                        | Critique | `supabase/seed.sql`                                | Durci (SF-009) + procédure de seed admin sécurisée.                                          |
| 10  | Aucune page légale /privacy, /terms, /cookies                    | Haut     | Marketing pages                                    | Corrigé (SF-007).                                                                            |

---

## Synthèse transversale

1. **Sécurité client-serveur déconnectée.** Le frontend stocke des tokens sensibles et fait confiance au backend pour les totaux, tandis que le backend fait confiance au client pour les calculs financiers.
2. **Permissions et audit incomplets.** Rôles et RLS existent, mais les actions sensibles manquent de proofing et les logs d'audit ne sont pas systématiques.
3. **Offline-first inachevé.** Couche de données offline (Dexie + queue) solide, mais service worker, icônes PWA et background sync manquants.
4. **Opérabilité immature.** Pas de monitoring, tests insuffisants, secrets locaux. L'application est fonctionnelle en dev mais fragile en prod.
5. **Conformité affichée sans fondement.** "RGPD-ready" et "conforme" sont sur le marketing sans les processus nécessaires (consentement, effacement, data residency).

---

## Plan d'action priorisé consolidé

### Phase 1 — Sécurité & conformité (0-2 semaines)

- [x] SF-001 : Rotation des clés Supabase/Vercel et retrait de `.env/.env.local`.
- [x] SF-002 : Échappement HTML dans les templates email.
- [ ] SF-003 : Recalculer les totaux de vente côté serveur (`complete_sale`).
- [x] SF-004 : Vérifier le mot de passe dans le challenge platform-admin.
- [x] SF-005 : Protéger `request-pin-reset`.
- [x] SF-006 : Restreindre `lookup-user-by-email`.
- [x] SF-007 : Publier `/privacy`, `/terms`, `/cookies`.
- [x] SF-008 : Rendre `send-auto-reminders` fail-closed.
- [x] SF-009 : Sécuriser le seed démo / compte admin.
- [x] SF-011/SF-012 : Rate-limit signup, API gateway, storefront.
- [x] SF-013 : Journalisation `activity_logs` et `login_attempts`.
- [x] SF-015 : CSP + security headers via `vercel.json`.
- [x] SF-016 : Error Boundary global.
- [x] SF-017/SF-018 : Service worker PWA + icônes.

### Phase 2 — Architecture & fiabilité (2-6 semaines)

- [ ] Retirer les tokens du `localStorage` (cookies httpOnly ou Supabase SSR).
- [ ] Nettoyer/supprimer le seed démo de la production.
- [x] Corriger l'ordre des migrations (rendues replayables).

### Phase 3 — UX & croissance (6-10 semaines)

- [x] Système de toast/notification global (SF-022).
- [x] Activer la caisse par défaut (SF-023).
- [ ] Wizard first-sale post-onboarding.
- [ ] Améliorer l'accessibilité marketing (skip link, contrastes).

### Phase 4 — Opérations & qualité (10-14 semaines)

- [x] Husky + lint-staged + `.nvmrc` (SF-036/SF-038).
- [x] CI bloquante sur E2E (SF-029).
- [ ] Sentry + logs structurés + health check + RUM (SF-031 partiel — health check OK, logs structurés non).
- [ ] Augmenter la couverture de tests (Edge Functions, auth, sync).
- [ ] Résoudre `npm audit` / Dependabot.
- [ ] Environnement de staging/preview.

### Phase 5 — Data residency & RGPD (spécifique)

- [ ] Auditer et documenter la data residency (SF-032).
- [ ] Considérer une région africaine pour Supabase.
- [ ] Mettre en place l'effacement/export des données (RGPD).
- [ ] Ajouter un gestionnaire de consentement cookies.

---

## Couverture fonctionnelle

D'après `analyse-comparative-features.md` : **~80 % des 108 features métier historiques** sont couvertes.

| Thème                                 | Tendance                                       |
| ------------------------------------- | ---------------------------------------------- |
| Auth, session, rôles                  | ✅ Solide                                      |
| Dashboard / Stock / Produits          | ✅ Solide                                      |
| Offline / sync                        | 🟡 Queue robuste, mais background sync absent  |
| Caisse / ventes                       | 🟡 Fonctionnelle, recalcul serveur manquant    |
| Marketing / landing                   | 🟡 Bon, mais accessibilité et copy à peaufiner |
| PWA native (push, vibration, install) | ❌ Manquant                                    |
| WhatsApp / impression                 | ❌ Manquant                                    |
| Analytics avancé                      | 🟡 Récemment revampé sur le design system      |

---

## Notes

- Ce document est une **synthèse**. Le détail technique reste dans `audit-report.html` et le plan actionnable dans `AUDIT_TICKETS.md`.
- La tâche #287 est close par la création de ce fichier.
- Les actions manuelles de rotation de secrets sont documentées dans `SECURITY_ROTATION.md`.
