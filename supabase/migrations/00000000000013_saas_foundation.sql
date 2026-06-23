-- SaaS foundation: plans, subscriptions, platform admins, org suspension, quotas

-- Pricing plans
CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly INTEGER NOT NULL DEFAULT 0,
  price_yearly INTEGER NOT NULL DEFAULT 0,
  max_users INTEGER,
  max_products INTEGER,
  max_locations INTEGER,
  max_monthly_movements INTEGER,
  includes_inventory BOOLEAN NOT NULL DEFAULT TRUE,
  includes_api BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  status TEXT NOT NULL DEFAULT 'trialing' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'suspended')),
  billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  current_period_starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_period_ends_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  trial_ends_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform-level admins (outside any organization)
CREATE TABLE platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization lifecycle flags
ALTER TABLE organizations
  ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN suspension_reason TEXT;

-- Global unique email for users (required for email-first login across orgs)
ALTER TABLE users
  ADD CONSTRAINT users_email_unique UNIQUE (email);

-- Trigger for subscriptions updated_at
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_subscriptions_org ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

-- Platform admins helper
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM platform_admins WHERE auth_user_id = auth.uid() AND is_active = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Current user's organization plan id
CREATE OR REPLACE FUNCTION current_org_plan_id()
RETURNS TEXT AS $$
BEGIN
  RETURN (
    SELECT s.plan_id FROM subscriptions s
    WHERE s.org_id = current_user_org_id()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies
CREATE POLICY plans_public_read ON plans
  FOR SELECT TO authenticated, anon USING (is_active = TRUE);

CREATE POLICY subscriptions_org_read ON subscriptions
  FOR SELECT TO authenticated USING (org_id = current_user_org_id() OR is_platform_admin());

CREATE POLICY platform_admins_super_all ON platform_admins
  FOR ALL TO authenticated USING (is_platform_admin()) WITH CHECK (is_platform_admin());

-- Allow platform admins to read all organizations
CREATE POLICY organizations_platform_read ON organizations
  FOR SELECT TO authenticated USING (is_platform_admin());

-- Allow platform admins to read users across orgs
CREATE POLICY users_platform_read ON users
  FOR SELECT TO authenticated USING (is_platform_admin());

-- Allow platform admins to read all tenant data
CREATE POLICY locations_platform_read ON locations FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY products_platform_read ON products FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY stock_levels_platform_read ON stock_levels FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY movements_platform_read ON movements FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY inventory_sessions_platform_read ON inventory_sessions FOR SELECT TO authenticated USING (is_platform_admin());
CREATE POLICY inventory_counts_platform_read ON inventory_counts FOR SELECT TO authenticated USING (is_platform_admin());

-- Seed default plans
INSERT INTO plans (id, name, description, price_monthly, price_yearly, max_users, max_products, max_locations, max_monthly_movements, includes_inventory, includes_api)
VALUES
  ('free', 'Gratuit', 'Parfait pour tester StockFlow', 0, 0, 2, 50, 1, 100, TRUE, FALSE),
  ('starter', 'Starter', 'Petites équipes et boutiques', 4900, 49900, 5, 500, 3, 2000, TRUE, FALSE),
  ('pro', 'Pro', 'Entreprises en croissance', 9900, 99900, 20, 5000, 10, 20000, TRUE, TRUE),
  ('enterprise', 'Enterprise', 'Sur mesure', 0, 0, NULL, NULL, NULL, NULL, TRUE, TRUE)
ON CONFLICT (id) DO NOTHING;

-- Helper: count movements this month for an org
CREATE OR REPLACE FUNCTION movements_count_this_month(p_org_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INT
    FROM movements m
    JOIN products p ON p.id = m.product_id
    WHERE p.org_id = p_org_id
      AND m.created_at >= date_trunc('month', NOW())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing organizations with a free plan subscription
INSERT INTO subscriptions (org_id, plan_id, status, current_period_starts_at, current_period_ends_at)
SELECT id, 'free', 'active', NOW(), NOW() + INTERVAL '100 years'
FROM organizations
WHERE NOT EXISTS (SELECT 1 FROM subscriptions WHERE subscriptions.org_id = organizations.id);
