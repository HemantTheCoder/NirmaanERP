-- =============================================================================
-- Nirmaan ERP — Migration 0035: RFIs & Change Orders
-- =============================================================================
-- Reuses the existing public.task_priority enum for RFI priority.

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE public.rfi_status AS ENUM ('open', 'answered', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.change_order_status AS ENUM (
    'draft', 'pending_approval', 'approved', 'rejected', 'implemented'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_seq INTEGER GENERATED ALWAYS AS IDENTITY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  question TEXT NOT NULL,
  status public.rfi_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  raised_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  response TEXT,
  responded_at TIMESTAMPTZ,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.rfis IS 'Requests for Information raised against a project, distinct from the general grievances/issues log.';

CREATE TABLE IF NOT EXISTS public.change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  co_seq INTEGER GENERATED ALWAYS AS IDENTITY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  cost_impact NUMERIC(14, 2) NOT NULL DEFAULT 0,
  schedule_impact_days INTEGER NOT NULL DEFAULT 0,
  status public.change_order_status NOT NULL DEFAULT 'draft',
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.change_orders IS 'Formal change orders with cost and schedule impact, requiring approval before implementation.';

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_rfis_project ON public.rfis(project_id);
CREATE INDEX IF NOT EXISTS idx_rfis_status ON public.rfis(status);
CREATE INDEX IF NOT EXISTS idx_rfis_assigned_to ON public.rfis(assigned_to);
CREATE INDEX IF NOT EXISTS idx_change_orders_project ON public.change_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_change_orders_status ON public.change_orders(status);

-- 4. Row Level Security
ALTER TABLE public.rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rfis_select" ON public.rfis;
DROP POLICY IF EXISTS "rfis_insert" ON public.rfis;
DROP POLICY IF EXISTS "rfis_update" ON public.rfis;
DROP POLICY IF EXISTS "rfis_delete" ON public.rfis;

CREATE POLICY "rfis_select" ON public.rfis FOR SELECT TO authenticated USING (true);

CREATE POLICY "rfis_insert" ON public.rfis FOR INSERT TO authenticated WITH CHECK (
  raised_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
);

CREATE POLICY "rfis_update" ON public.rfis FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
  OR assigned_to = auth.uid()
  OR raised_by = auth.uid()
);

CREATE POLICY "rfis_delete" ON public.rfis FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "change_orders_select" ON public.change_orders;
DROP POLICY IF EXISTS "change_orders_insert" ON public.change_orders;
DROP POLICY IF EXISTS "change_orders_update" ON public.change_orders;
DROP POLICY IF EXISTS "change_orders_delete" ON public.change_orders;

CREATE POLICY "change_orders_select" ON public.change_orders FOR SELECT TO authenticated USING (true);

CREATE POLICY "change_orders_insert" ON public.change_orders FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "change_orders_update" ON public.change_orders FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "change_orders_delete" ON public.change_orders FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
