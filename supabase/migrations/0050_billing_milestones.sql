-- =============================================================================
-- Nirmaan ERP — Migration 0050: Billing Milestones (client draw requests)
-- =============================================================================
-- The client portal today is read/approve-only with no payment visibility.
-- This adds a per-project milestone billing schedule (e.g. "30% on
-- foundation completion") that staff manage and the client can see —
-- closing the "client billing" module gap without touching expenses/budget,
-- which track internal cost, not what's owed to Nirmaan by the client.

DO $$ BEGIN
  CREATE TYPE public.billing_milestone_status AS ENUM ('pending', 'invoiced', 'paid');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.billing_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  due_date DATE,
  status public.billing_milestone_status NOT NULL DEFAULT 'pending',
  invoiced_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.billing_milestones IS
  'Per-project client billing/draw-request schedule — what is owed by the client, distinct from expenses (internal cost).';

CREATE INDEX IF NOT EXISTS idx_billing_milestones_project ON public.billing_milestones(project_id);

ALTER TABLE public.billing_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_milestones_select" ON public.billing_milestones;
DROP POLICY IF EXISTS "billing_milestones_insert" ON public.billing_milestones;
DROP POLICY IF EXISTS "billing_milestones_update" ON public.billing_milestones;
DROP POLICY IF EXISTS "billing_milestones_delete" ON public.billing_milestones;

-- Same client_id-scoping pattern as 0046 (project_delays/dpr): staff see
-- every project, a client account only sees milestones on their own
-- linked project(s).
CREATE POLICY "billing_milestones_select" ON public.billing_milestones
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = billing_milestones.project_id AND p.client_id = auth.uid())
);

CREATE POLICY "billing_milestones_insert" ON public.billing_milestones FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "billing_milestones_update" ON public.billing_milestones FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "billing_milestones_delete" ON public.billing_milestones FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

NOTIFY pgrst, 'reload schema';
