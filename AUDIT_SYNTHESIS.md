# Synthèse exécutive — Audit StockFlow vNext

> Date : 2026-06-23  
> Source : consolidation de `audit-report.html`, `AUDIT_TICKETS.md`, `analyse-comparative-features.md`, `SECURITY_ROTATION.md` et des audits spécialisés #327-#334.

---

## Verdict global

**Score : 5,8 / 10**

StockFlow vNext dispose d'une architecture moderne (React 19, Supabase, Vite, Tailwind v4, shadcn/ui) et d'une base mobile-first solide. La sécurité et la conformité ont été significativement renforcies au cours des derniers audits, mais l'application **n'est pas prête à une production à grande échelle** tant que les secrets historiques n'ont pas été tournés et que la session n'est pas migrée hors du stockage navigateur.

---

## Scores par domaine

| Domaine                   | Score    | État synthétique                                                                                                           |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**              | 7,3 / 10 | Architecture propre, mais tokens en `sessionStorage`, AppLock inactif, utilitaires CSS legacy résiduels, PWA inachevée.    |
| **Backend Supabase**      | 5,7 / 10 | Fonctionnel ; recalcul serveur des totaux de vente, challenge admin corrigé, RLS et cross-tenant durcis.                   |
| **UI/UX & Parcours**      | 6,8 / 10 | Bonne base responsive, mais friction jusqu'à la première vente, copywriting incohérent, accessibilité marketing à revoir.  |
| **Sécurité & Compliance** | 5,0 / 10 | Secrets retirés des scripts, audit logging et consentement RGPD en place ; rotation manuelle et purge git restent à faire. |
| **Tests, DevOps & Ops**   | 4,6 / 10 | Build vert, TruffleHog en CI, monitoring partiel (Sentry), mais couverture très faible, E2E non bloquante historiquement.  |

---

## Top 10 risques critiques — statut post-audit

| #   | Risque                                                           | Sévérité | Fichier(s) clé                                                                                     | Statut post-audit                                                                                         |
| --- | ---------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Clés et tokens exposés localement / dans l'historique git        | Critique | `.env`, `.env.local`, scripts `smoke*`, `check-admin`                                              | Fichiers retirés du working tree ; scripts nettoyés. **Rotation des clés + purge git manuelles à faire.** |
| 2   | `complete_sale` fait confiance aux totaux envoyés par le client  | Critique | `supabase/functions/complete-sale/index.ts`, `20260629020000_complete_sale_recalculate_totals.sql` | **Corrigé** : validation des prix unitaires en Edge Function et recalcul serveur des totaux/TVA.          |
| 3   | Challenge "platform-admin" ne vérifiait pas le mot de passe      | Critique | `create-platform-challenge/index.ts`, `_shared/platform.ts`                                        | **Corrigé** (SF-004) — PBKDF2 + verrouillage + challenge à usage unique.                                  |
| 4   | XSS dans les templates email                                     | Critique | `send-receipt-email`, `send-document-email`, etc.                                                  | **Corrigé** (SF-002) avec échappement HTML et `escapeHtml` partagé.                                       |
| 5   | `request-pin-reset` public non authentifié                       | Critique | `supabase/functions/request-pin-reset/index.ts`                                                    | **Corrigé** (SF-005) — requiert un JWT valide correspondant à l'email.                                    |
| 6   | `lookup-user-by-email` expose nom, rôle, orgId, orgName          | Critique | `supabase/functions/lookup-user-by-email/index.ts`                                                 | **Corrigé** (SF-006) — retour minimal et rate-limité.                                                     |
| 7   | Session stockée dans `sessionStorage` (vulnérable au XSS)        | Critique | `src/services/authStorage.ts`                                                                      | `localStorage` retiré. **Migration vers cookies httpOnly / SSR toujours requise.**                        |
| 8   | `send-auto-reminders` fail-open si `AUTO_REMINDER_SECRET` absent | Critique | `supabase/functions/send-auto-reminders/index.ts`                                                  | **Corrigé** (SF-008) — fail-closed + retour d'erreur générique.                                           |
| 9   | Seed contenant admin démo avec PIN faible                        | Critique | `supabase/seed.sql`, `scripts/seed-admin.mjs`                                                      | **Corrigé** (SF-009) — génération via `crypto.randomInt`, mot de passe ≥20 caractères.                    |
| 10  | Aucune page légale /privacy, /terms, /cookies                    | Haut     | Marketing pages                                                                                    | **Corrigé** (SF-007) + consentement explicite au signup + gestionnaire cookies RGPD.                      |

---

## Synthèse des audits #327 — #334

| #   | Thème                              | État                            | Livrables clés                                                                                                                                       |
| --- | ---------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 327 | Authentification & session         | Rapporté + correctifs appliqués | `AUTHENTICATION_SECURITY_AUDIT.md` ; wildcard redirect retiré, `redirectTo` validé, propagation JWT corrigée, CORS/copy magic link ajustés.          |
| 328 | Contrôle d'accès                   | Rapporté + durci                | `ACCESS_CONTROL_AUDIT.md` ; politiques RLS critiques durcies, fonctions document scellées contre le cross-tenant.                                    |
| 329 | Validation & nettoyage des entrées | **En cours** (agent background) | `INPUT_VALIDATION_AUDIT.md` attendu.                                                                                                                 |
| 330 | Gestion des secrets                | Rapporté + scripts nettoyés     | `SECRETS_MANAGEMENT_AUDIT.md` mis à jour ; backup supprimé, Sentry/logger rédacteurs, TruffleHog CI, HSTS. **Rotations manuelles restantes.**        |
| 331 | Audit logging                      | Corrigé                         | `AUDIT_LOGGING_AUDIT.md` ; deny RLS sur tables sensibles, `cleanup_old_audit_logs`, fonction/cron de cleanup, `logActivity` sur mutations critiques. |
| 332 | Data residency                     | Documenté                       | `DATA_RESIDENCY_AUDIT.md` ; hébergeurs/régions inventoriés, mentions légales mises à jour. Migration région africaine à étudier.                     |
| 333 | Pages légales / RGPD               | Corrigé                         | `LEGAL_PAGES_AUDIT.md` ; consentement signup, gestionnaire cookies, export/effacement données.                                                       |
| 334 | PCI-DSS / mobile money             | Documenté                       | `PCI_DSS_MOBILE_MONEY_AUDIT.md` ; copy marketing corrigé, note caisse sur paiements externes. Aucune saisie de données cartes.                       |

---

## Synthèse transversale

1. **Sécurité client-serveur reconnectée.** Les totaux de vente sont recalculés côté serveur, le challenge platform-admin est opérationnel, et les fonctions document vérifient l'appartenance org.
2. **Permissions et audit renforcés.** RLS durci sur les tables sensibles, logs d'audit systématiques sur les mutations critiques, nettoyage automatique des vieux logs.
3. **Conformité RGPD affichée et fondée.** Consentement explicite, pages légales, gestionnaire de cookies, export/effacement des données et data residency documentée.
4. **Offline-first inachevé.** Couche de données offline (Dexie + queue) solide, mais service worker, icônes PWA et background sync manquants.
5. **Opérabilité en progrès.** TruffleHog en CI, Sentry configuré, headers de sécurité déployés. Restent : couverture de tests, staging, résolution des alertes `npm audit`.

---

## Plan d'action priorisé consolidé

### Phase 1 — Sécurité & conformité (0-2 semaines)

- [x] SF-001 : Rotation des clés Supabase/Vercel et retrait de `.env/.env.local` du working tree.
- [x] SF-002 : Échappement HTML dans les templates email.
- [x] SF-003 : Recalculer les totaux de vente côté serveur (`complete_sale`).
- [x] SF-004 : Vérifier le mot de passe dans le challenge platform-admin.
- [x] SF-005 : Protéger `request-pin-reset`.
- [x] SF-006 : Restreindre `lookup-user-by-email`.
- [x] SF-007 : Publier `/privacy`, `/terms`, `/cookies` + consentement signup.
- [x] SF-008 : Rendre `send-auto-reminders` fail-closed.
- [x] SF-009 : Sécuriser le seed démo / compte admin.
- [x] SF-011/SF-012 : Rate-limit signup, API gateway, storefront.
- [x] SF-013 : Journalisation `activity_logs` et `login_attempts` + rétention automatique.
- [x] SF-015 : CSP + security headers via `vercel.json` (HSTS inclus).
- [x] SF-016 : Error Boundary global.
- [x] SF-017/SF-018 : Service worker PWA + icônes.
- [ ] **Rotations manuelles P0** : clés Supabase anon/service_role, Resend, `AUTO_REMINDER_SECRET`, mot de passe admin, purge git (`filter-repo`).

### Phase 2 — Architecture & fiabilité (2-6 semaines)

- [ ] Migrer les tokens hors du stockage navigateur (`sessionStorage`) vers des cookies httpOnly / Supabase SSR.
- [ ] Nettoyer/supprimer le seed démo de la production.
- [x] Corriger l'ordre des migrations (rendues replayables).

### Phase 3 — UX & croissance (6-10 semaines)

- [x] Système de toast/notification global (SF-022).
- [x] Activer la caisse par défaut (SF-023).
- [ ] Wizard first-sale post-onboarding.
- [ ] Améliorer l'accessibilité marketing (skip link, contrastes).

### Phase 4 — Opérations & qualité (10-14 semaines)

- [x] Husky + lint-staged + `.nvmrc` (SF-036/SF-038).
- [x] CI bloquante sur E2E (SF-029) + scan secrets TruffleHog.
- [x] Sentry + logs structurés + health check renforcé (SF-031).
- [ ] Augmenter la couverture de tests (Edge Functions, auth, sync).
- [ ] Résoudre `npm audit` / Dependabot.
- [ ] Environnement de staging/preview.

### Phase 5 — Data residency & RGPD (spécifique)

- [x] Auditer et documenter la data residency (SF-032).
- [ ] Considérer une région africaine pour Supabase.
- [x] Mettre en place l'effacement/export des données (RGPD).
- [x] Ajouter un gestionnaire de consentement cookies.

---

## Couverture fonctionnelle

D'après `analyse-comparative-features.md` : **~80 % des 108 features métier historiques** sont couvertes.

| Thème                                 | Tendance                                       |
| ------------------------------------- | ---------------------------------------------- |
| Auth, session, rôles                  | ✅ Solide                                      |
| Dashboard / Stock / Produits          | ✅ Solide                                      |
| Offline / sync                        | 🟡 Queue robuste, mais background sync absent  |
| Caisse / ventes                       | ✅ Fonctionnelle, recalcul serveur en place    |
| Marketing / landing                   | 🟡 Bon, mais accessibilité et copy à peaufiner |
| PWA native (push, vibration, install) | ❌ Manquant                                    |
| WhatsApp / impression                 | ❌ Manquant                                    |
| Analytics avancé                      | 🟡 Récemment revampé sur le design system      |

---

## Notes

- Ce document est une **synthèse**. Le détail technique reste dans les rapports spécialisés (`AUTHENTICATION_SECURITY_AUDIT.md`, `ACCESS_CONTROL_AUDIT.md`, `SECRETS_MANAGEMENT_AUDIT.md`, `AUDIT_LOGGING_AUDIT.md`, `DATA_RESIDENCY_AUDIT.md`, `LEGAL_PAGES_AUDIT.md`, `PCI_DSS_MOBILE_MONEY_AUDIT.md`) et dans `audit-report.html`.
- Les actions manuelles de rotation de secrets et de purge git sont documentées pas à pas dans `SECURITY_ROTATION.md`.
- L'audit #329 (validation & nettoyage des entrées) est en cours via un agent dédié ; son rapport et ses correctifs seront intégrés dès réception.
