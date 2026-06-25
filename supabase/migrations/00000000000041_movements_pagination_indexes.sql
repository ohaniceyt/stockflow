-- Indexes to speed up paginated movement history queries.
CREATE INDEX IF NOT EXISTS idx_movements_org_id_created_at ON movements(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_product_id_created_at ON movements(product_id, created_at DESC);
