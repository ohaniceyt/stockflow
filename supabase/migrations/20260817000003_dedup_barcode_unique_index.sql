-- Lot D (item différé) — Unicité du barcode par entreprise.
--
-- Un index UNIQUE ne peut pas être NOT VALID (contrairement aux FK/CHECK),
-- donc on ne pouvait pas le poser dans 20260817000002 sans risquer un
-- échec de deploy sur d'éventuels doublons existants. Cette migration fait
-- le ménage puis pose l'index, le tout dans une même transaction (un fichier
-- de migration = une transaction) : il n'existe jamais de fenêtre où l'index
-- serait présent avec des doublons.
--
-- Portée : (org_id, barcode). Le scan caisse résout le barcode côté client
-- sur la liste des produits de l'org (useCashier.ts:
-- `availableProducts.find((p) => p.barcode === barcode)`), sans lookup
-- global. Un barcode dupliqué renvoie aujourd'hui le 1er match arbitraire
-- du tableau — l'autre produit n'est de toute façon pas scannable, donc
-- dédoublonner corrige aussi le scan.
--
-- Règle de garde du gagnant (validée) : pour chaque groupe (org_id, barcode),
-- on garde le produit avec le PLUS de mouvements non annulés ; tiebreak
-- updated_at DESC, puis id ASC. Les perdants voient leur barcode mis à NULL
-- (le produit est conservé, reste trouvable par nom). Aucune ligne supprimée.
--
-- Idempotente : les UPDATE sont des no-ops s'il n'y a rien à nettoyer, et
-- l'index est créé avec IF NOT EXISTS. Rejouable.

-- 1a. Barcodes vides / whitespace-only -> NULL.
UPDATE products
SET barcode = NULL
WHERE barcode IS NOT NULL AND btrim(barcode) = '';

-- 1b. Canonicalisation : trimer les espaces environnantes.
UPDATE products
SET barcode = btrim(barcode)
WHERE barcode IS NOT NULL AND barcode <> btrim(barcode);

-- 1c. Dédoublonnage : NULL sur les perdants de chaque groupe (org_id, barcode).
-- counts agrège les mouvements non annulés (idx_movements_product existe).
-- Le LEFT JOIN couvre les produits sans mouvement (count 0). rn = 1 = gagnant.
WITH counts AS (
  SELECT product_id, COUNT(*) AS movement_count
  FROM movements
  WHERE is_cancelled = FALSE
  GROUP BY product_id
),
ranked AS (
  SELECT p.id,
    ROW_NUMBER() OVER (
      PARTITION BY p.org_id, p.barcode
      ORDER BY COALESCE(c.movement_count, 0) DESC,
               p.updated_at DESC,
               p.id ASC
    ) AS rn
  FROM products p
  LEFT JOIN counts c ON c.product_id = p.id
  WHERE p.barcode IS NOT NULL
)
UPDATE products
SET barcode = NULL
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 1d. Index unique partiel. On utilise un INDEX (pas une CONSTRAINT) car PG
-- n'accepte pas de WHERE sur une contrainte de table. Permet plusieurs
-- barcode IS NULL dans la même entreprise.
CREATE UNIQUE INDEX IF NOT EXISTS products_org_barcode_uniq
  ON products (org_id, barcode)
  WHERE barcode IS NOT NULL;