# Audit conformité financière et réglementaire — StockFlow vNext

> Date : 2026-06-23  
> Statut : MVP — plusieurs lacunes critiques à traiter avant une commercialisation en Afrique francophone.

---

## 1. Fiscalité / TVA

### Ce qui existe

- Taxe au niveau de l'organisation : `organizations.has_tax_enabled`, `tax_name`, `tax_rate`, `tax_id`.
- La caisse applique un taux global sur le sous-total du panier.
- Les reçus stockent `subtotal`, `tax_amount`, `total`.
- `complete_sale` recalcule les totaux ligne à ligne mais **somme le `tax_amount` envoyé par le client**.

### Risques

| #   | Sévérité     | Problème                                                                                                                              | Preuve                                                                                                    |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| 1.1 | **Critique** | Le montant de taxe est **fourni par le client** et non recalculé côté serveur. Un caissier malveillant peut sous/sur-déclarer la TVA. | `complete_sale` valide uniquement les prix unitaires ; la fonction DB additionne `tax_amount` du payload. |
| 1.2 | **Moyen**    | Aucune taxe par produit : tous les articles partagent le taux org.                                                                    | La table `products` n'a pas de colonnes fiscales.                                                         |
| 1.3 | **Moyen**    | Pas de mode prix TTC / HT explicite.                                                                                                  | La taxe est toujours ajoutée au sous-total.                                                               |

### Recommandations

1. Recalculer la taxe côté serveur dans `complete_sale` à partir de `organizations.tax_rate` et du sous-total validé. Refuser tout écart avec le `tax_amount` client.
2. Ajouter un taux de taxe optionnel par produit et un flag d'exemption si le catalogue le nécessite.
3. Documenter le mode de saisie des prix (HT ou TTC) par marché cible.

---

## 2. Exigences des reçus

### Ce qui existe

- Numérotation séquentielle par org via `next_document_number`.
- PDF de reçu avec nom org, adresse, téléphone, email, taxe, mentions légales optionnelles.
- Annulation possible avec flag `is_cancelled` et mouvements de correction.

### Risques

| #   | Sévérité     | Problème                                                                                        |
| --- | ------------ | ----------------------------------------------------------------------------------------------- |
| 2.1 | **Critique** | Les reçus sont **mutables** par tout membre authentifié de l'org (RLS `FOR ALL` UPDATE/DELETE). |
| 2.2 | **Élevé**    | Les mentions légales sont optionnelles et non validées.                                         |
| 2.3 | **Moyen**    | Le PDF ne mentionne pas le caissier, l'emplacement ni le client.                                |
| 2.4 | **Faible**   | Le `change_due` peut être négatif si `amount_paid < total`.                                     |

### Recommandations

1. Restreindre les reçus en lecture seule via RLS ; n'autoriser que l'annulation via une RPC sécurisée. Ajouter un trigger bloquant toute modification autre que l'annulation.
2. Valider `amount_paid >= total` pour les paiements comptants ou créer un flux de paiement partiel explicite.
3. Ajouter caissier, emplacement et client sur le PDF et l'affichage écran.

---

## 3. Conformité des sessions de caisse

### Ce qui existe

- `cashier_sessions` : fond d'ouverture, fond de clôture, recette journalière, dates, opérateur, emplacement.
- Une seule session ouverte par emplacement.
- Ouverture / fermeture contrôlées depuis l'UI.

### Risques

| #   | Sévérité   | Problème                                                                                                |
| --- | ---------- | ------------------------------------------------------------------------------------------------------- |
| 3.1 | **Élevé**  | `daily_revenue` est incrémenté du **sous-total HT**, pas du total TTC, ce qui fausse la reconciliation. |
| 3.2 | **Élevé**  | Les valeurs de clôture sont envoyées par le client et non recalculées côté serveur.                     |
| 3.3 | **Moyen**  | L'annulation d'un reçu après clôture de session ne recalcule pas la recette.                            |
| 3.4 | **Moyen**  | Pas de journal d'audit dédié pour l'ouverture/fermeture/annulation de session.                          |
| 3.5 | **Faible** | L'écart de caisse n'est pas persisté.                                                                   |

### Recommandations

1. Recalculer `daily_revenue` à la clôture à partir des reçus de la session (TTC) ou incrémenter systématiquement du `total`.
2. Persister l'écart de caisse (`closing_balance - (opening_balance + daily_revenue)`) et alerter sur les écarts importants.
3. Journaliser ouverture, fermeture et annulations dans `activity_logs`.

---

## 4. Cycle de vie de la facturation (code présent, UI retirée)

### Ce qui existe

- Schéma complet `invoices`, `invoice_items`, `payments`, `invoice_sequences` et RPCs restent en base.
- Edge Functions de PDF, email et relances automatiques toujours déployées.
- `pg_cron` appelle `send-auto-reminders` quotidiennement.
- `organizations.has_invoicing_enabled` existe mais n'est **ni exposé ni vérifié**.

### Risques

| #   | Sévérité     | Problème                                                                                         |
| --- | ------------ | ------------------------------------------------------------------------------------------------ |
| 4.1 | **Critique** | Les factures restent modifiables/supprimables par tout membre authentifié malgré l'absence d'UI. |
| 4.2 | **Élevé**    | `invoice_sequences` est inscriptible par les membres de l'org.                                   |
| 4.3 | **Élevé**    | `has_invoicing_enabled` est mort : non vérifié côté backend, non exposé côté frontend.           |
| 4.4 | **Moyen**    | Le cron de relances tourne pour toutes les orgs, qu'invoicing soit activé ou non.                |
| 4.5 | **Faible**   | Code facturation non utilisé = dette technique et surface d'attaque.                             |

### Recommandations

1. **Décider** : soit (a) supprimer totalement le sous-système facturation, soit (b) le restaurer derrière un flag activé et sécurisé.
2. Si conservé : restreindre les mutations aux rôles admin/super_admin ; figer numéro, date, montants après émission.
3. Désactiver le cron de relances jusqu'à ce que la facturation soit un produit supporté.

---

## 5. Spécificités des marchés africains

### Points forts

- Devises et fuseaux horaires adaptés (XOF, XAF, CDF, KMF, etc.).
- `payment_method` inclut `mobile_money`.
- Le PDF de reçu affiche le NIF et les mentions légales.

### Risques

| #   | Sévérité   | Problème                                                                                               |
| --- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 5.1 | **Moyen**  | Mobile money n'est qu'une étiquette : aucune intégration Wave, Orange Money, MTN MoMo, M-PESA.         |
| 5.2 | **Moyen**  | Pas d'imprimante fiscale / thermique ESC-POS ni de signature fiscale. Le reçu est un PDF A4 générique. |
| 5.3 | **Moyen**  | Pas d'export OHADA/SYSCOHADA (journal des ventes, journal des stocks).                                 |
| 5.4 | **Faible** | Pas d'intégration API auprès des autorités fiscales (DGI, OTR, etc.).                                  |

### Recommandations

1. Documenter que mobile money est un libellé uniquement ; planifier les intégrations selon le marché.
2. Pour le commerce réglementé, prévoir une sortie thermique / imprimante fiscale et un stockage fiscal non modifiable.
3. Fournir un export compatible OHADA : journal des ventes, journal des stocks avec code compte, montant, taxe.

---

## 6. Synthèse des priorités

| Priorité | Sévérité | Action recommandée                                                    |
| -------- | -------- | --------------------------------------------------------------------- |
| P0       | Critique | Immuabilité des reçus / factures : restreindre RLS + triggers.        |
| P0       | Critique | Supprimer ou sécuriser le sous-système facturation (UI absente).      |
| P1       | Élevé    | Recalculer la taxe côté serveur dans `complete_sale`.                 |
| P1       | Élevé    | Recalculer la recette journalière à la clôture de caisse (TTC).       |
| P2       | Moyen    | Ajouter opérateur / emplacement / client sur le reçu.                 |
| P2       | Moyen    | Journaliser le cycle de vie des sessions de caisse.                   |
| P2       | Moyen    | Support fiscal par produit et export OHADA.                           |
| P3       | Faible   | Désactiver le cron de relances factures.                              |
| P3       | Faible   | Interdire `amount_paid < total` ou créer un flux de paiement partiel. |
