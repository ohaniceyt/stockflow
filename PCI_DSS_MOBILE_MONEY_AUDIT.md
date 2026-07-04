# Audit — Paiements, PCI-DSS et mobile money

> Date : 2026-06-23
> Scope : `src/features/cashier/*`, `supabase/functions/complete-sale/index.ts`, `supabase/functions/change-org-plan/index.ts`, schéma `subscriptions` / `receipts`, pages marketing.
> Statut : **Aucune donnée de carte ou de portefeuille mobile n'est capturée ni traitée.** PCI-DSS n'est donc pas en scope aujourd'hui. L'application enregistre uniquement le mode de paiement sous forme d'étiquette.

---

## 1. Résumé exécutif

StockFlow ne traite pas de paiements électroniques. La caisse :

- enregistre un libellé de mode de paiement (`cash`, `card`, `mobile_money`, `other`) ;
- enregistre le montant perçu ;
- ne reçoit jamais de numéro de carte, de token de portefeuille mobile, de PIN mobile money, ni d'identifiant de transaction tiers.

Les champs `stripe_customer_id` et `stripe_subscription_id` existent dans la table `subscriptions`, mais aucune intégration Stripe n'est active dans le code actuel. Le changement de plan (`change-org-plan`, `platform-set-organization-plan`) met à jour la base locale sans appeler un fournisseur de paiement.

**Conclusion immédiate** : le périmètre PCI-DSS est vide. Les risques portent surtout sur les promesses marketing et la préparation d'une future intégration.

---

## 2. Contrôles positifs

| Domaine                             | Observation                                                                    | Preuve                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| Pas de CHD capturé                  | Aucun champ de numéro de carte, CVV, date d'expiration, token de portefeuille. | `complete-sale` payload, schéma `receipts`                 |
| Paiement enregistré comme étiquette | `payment_method` est une chaîne textuelle, pas un appel réseau vers un PSP.    | `supabase/functions/complete-sale/index.ts`                |
| Recettes immuables                  | `receipts` est durci par RLS et trigger (access-control + financial audit).    | `ACCESS_CONTROL_AUDIT.md`, `FINANCIAL_REGULATORY_AUDIT.md` |
| Montant reçu validé                 | `complete-sale` valide que `amount_paid` est un nombre.                        | `complete-sale/index.ts`                                   |

---

## 3. Risques et recommandations

### 3.1 Promesses marketing non étayées (P1)

| #     | Problème                                                                                                             | Preuve                                                            | Recommandation                                                                                                                         |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 3.1.1 | Landing page et FAQ affirment "mobile money et carte supportés".                                                     | `LandingPage.tsx`, `PosCashierFeaturePage.tsx`, `PricingPage.tsx` | Remplacer par "enregistrement du mode de paiement : cash, carte, mobile money" pour ne pas suggérer un traitement électronique.        |
| 3.1.2 | L'utilisateur peut sélectionner "carte" ou "mobile money" sans que le système vérifie qu'un paiement réel a eu lieu. | `CartPanel.tsx`                                                   | Ajouter une mention UI : "L'encaissement électronique s'effectue en dehors de StockFlow ; ce champ sert à l'enregistrement comptable." |

### 3.2 Préparation d'une future intégration (P1)

| #     | Problème                                                                             | Recommandation                                                                                           |
| ----- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| 3.2.1 | Aucune architecture définie pour un futur PSP (Stripe, PayDunya, Flutterwave, etc.). | Documenter que tout PSP intégré devra être en scope PCI-DSS SAQ A / SAQ A-EP selon le modèle.            |
| 3.2.2 | Les secrets PSP n'ont pas de place définie.                                          | Prévoir des variables d'environnement chiffrées (Vercel + Supabase Vault) et jamais dans le repo.        |
| 3.2.3 | Aucune validation de montant reçu contre transaction externe.                        | Lors de l'intégration, toujours vérifier le montant côté serveur via l'API du PSP, jamais via le client. |
| 3.2.4 | Aucune idempotence / déduplication d'une transaction.                                | Prévoir un `provider_transaction_id` unique indexé sur `receipts` ou une table dédiée.                   |
| 3.2.5 | Pas de gestion des remboursements.                                                   | Spécifier un workflow de remboursement lié au PSP dès la conception.                                     |

### 3.3 Mobile money spécifique (P1/P2)

| #     | Problème                                                                            | Recommandation                                                                                                                              |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.3.1 | Aucune intégration avec les APIs Orange Money, MTN MoMo, Wave, etc.                 | Si intégration future, utiliser le fournisseur agrégateur local certifié et ne jamais stocker les identifiants utilisateur du portefeuille. |
| 3.3.2 | Le "paiement mobile money" actuel repose sur la confiance entre caissier et client. | Ajouter une alerte/mention dans l'UI indiquant que la transaction est manuelle jusqu'à intégration automatique.                             |

---

## 4. Plan d'action

### Immédiat

- [x] Vérifier qu'aucune CHD n'est capturée ni transmise.

### Court terme

- [ ] Corriger le wording marketing pour refléter l'enregistrement, non le traitement.
- [ ] Ajouter une mention UI dans la caisse pour préciser que le paiement électronique est externe.

### Moyen terme

- [ ] Choisir un PSP et un modèle d'intégration (redirect / iframe / backend-to-backend).
- [ ] Mettre en place l'architecture PCI-DSS correspondante avant de capturer la moindre CHD.
- [ ] Ajouter `provider_transaction_id` et workflow de remboursement.

---

## 5. Vérifications

- [x] Aucune saisie de numéro de carte dans l'application.
- [x] Aucun appel réseau vers un PSP dans le code.
- [ ] Wording marketing corrigé.
- [ ] UI caisse informe l'utilisateur du caractère manuel.
