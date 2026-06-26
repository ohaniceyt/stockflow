-- Historique des slugs d'organisation pour permettre des redirections
-- après modification par un platform admin.

CREATE TABLE IF NOT EXISTS public.organization_slug_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  old_slug TEXT NOT NULL,
  new_slug TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_slug_history_org_id
  ON public.organization_slug_history(org_id);

CREATE INDEX IF NOT EXISTS idx_org_slug_history_old_slug
  ON public.organization_slug_history(old_slug);

-- RLS: only platform admins can read/write history.
ALTER TABLE public.organization_slug_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_slug_history_platform_admin_all
  ON public.organization_slug_history
  FOR ALL TO authenticated
  USING (is_platform_admin());

