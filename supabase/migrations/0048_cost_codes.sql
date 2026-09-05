-- =============================================================================
-- Nirmaan ERP — Migration 0048: Cost Codes (WBS-level budgeting)
-- =============================================================================
-- Budgeting today is a single budget_allocated number per project. This adds
-- a per-project cost-code breakdown (e.g. "03-3000 Concrete", "26-0000
-- Electrical") each with its own budgeted amount, and links expenses to a
-- code so actual spend can be tracked against budget at that level instead
-- of only the five broad trade categories already on expenses.category.

CREATE TABLE IF NOT EXISTS public.cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  budgeted_amount NUMERIC NOT NULL DEFAULT 0 CHECK (budgeted_amount >= 0),
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, code)
);

COMMENT ON TABLE public.cost_codes IS
  'Per-project WBS/cost-code budget lines. expenses.cost_code_id optionally links an expense to one of these for budget-vs-actual tracking at the code level.';

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS cost_code_id UUID REFERENCES public.cost_codes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cost_codes_project ON public.cost_codes(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_cost_code ON public.expenses(cost_code_id);

-- Row Level Security — mirrors expenses' staff-facing visibility: cost
-- codes are a budget-structure detail, not exposed to client/contractor
-- roles even though they're readable by any project-facing staff role
-- (site_staff needs the list to pick a code when logging an expense).
ALTER TABLE public.cost_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cost_codes_select" ON public.cost_codes;
DROP POLICY IF EXISTS "cost_codes_insert" ON public.cost_codes;
DROP POLICY IF EXISTS "cost_codes_update" ON public.cost_codes;
DROP POLICY IF EXISTS "cost_codes_delete" ON public.cost_codes;

CREATE POLICY "cost_codes_select" ON public.cost_codes FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
);

CREATE POLICY "cost_codes_insert" ON public.cost_codes FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "cost_codes_update" ON public.cost_codes FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "cost_codes_delete" ON public.cost_codes FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

NOTIFY pgrst, 'reload schema';
