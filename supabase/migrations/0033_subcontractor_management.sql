-- =============================================================================
-- Nirmaan ERP — Migration 0033: Subcontractor Management
-- =============================================================================
-- Builds on the `vendors` table from 0032 (vendor_type = 'subcontractor' or 'both').

-- 1. Enum types
DO $$ BEGIN
  CREATE TYPE public.subcontract_status AS ENUM ('draft', 'active', 'completed', 'terminated');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tables
CREATE TABLE IF NOT EXISTS public.subcontracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_seq INTEGER GENERATED ALWAYS AS IDENTITY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  scope_of_work TEXT NOT NULL,
  contract_value NUMERIC(14, 2) NOT NULL CHECK (contract_value >= 0),
  start_date DATE,
  end_date DATE,
  retention_percentage NUMERIC(5, 2) NOT NULL DEFAULT 5 CHECK (retention_percentage >= 0 AND retention_percentage <= 100),
  status public.subcontract_status NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subcontracts IS 'Contracts issued to subcontractor vendors for a defined scope of work on a project.';

CREATE TABLE IF NOT EXISTS public.subcontractor_performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontract_id UUID NOT NULL REFERENCES public.subcontracts(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  review_date DATE NOT NULL DEFAULT CURRENT_DATE,
  quality_rating SMALLINT NOT NULL CHECK (quality_rating BETWEEN 1 AND 5),
  timeliness_rating SMALLINT NOT NULL CHECK (timeliness_rating BETWEEN 1 AND 5),
  safety_rating SMALLINT NOT NULL CHECK (safety_rating BETWEEN 1 AND 5),
  comments TEXT,
  reviewed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_subcontracts_project ON public.subcontracts(project_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_vendor ON public.subcontracts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_subcontracts_status ON public.subcontracts(status);
CREATE INDEX IF NOT EXISTS idx_perf_reviews_vendor ON public.subcontractor_performance_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_perf_reviews_subcontract ON public.subcontractor_performance_reviews(subcontract_id);

-- 4. Row Level Security
ALTER TABLE public.subcontracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcontractor_performance_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subcontracts_select" ON public.subcontracts;
DROP POLICY IF EXISTS "subcontracts_insert" ON public.subcontracts;
DROP POLICY IF EXISTS "subcontracts_update" ON public.subcontracts;
DROP POLICY IF EXISTS "subcontracts_delete" ON public.subcontracts;

CREATE POLICY "subcontracts_select" ON public.subcontracts FOR SELECT TO authenticated USING (true);

CREATE POLICY "subcontracts_insert" ON public.subcontracts FOR INSERT TO authenticated WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "subcontracts_update" ON public.subcontracts FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "subcontracts_delete" ON public.subcontracts FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "perf_reviews_select" ON public.subcontractor_performance_reviews;
DROP POLICY IF EXISTS "perf_reviews_insert" ON public.subcontractor_performance_reviews;
DROP POLICY IF EXISTS "perf_reviews_update" ON public.subcontractor_performance_reviews;
DROP POLICY IF EXISTS "perf_reviews_delete" ON public.subcontractor_performance_reviews;

CREATE POLICY "perf_reviews_select" ON public.subcontractor_performance_reviews FOR SELECT TO authenticated USING (true);

CREATE POLICY "perf_reviews_insert" ON public.subcontractor_performance_reviews FOR INSERT TO authenticated WITH CHECK (
  reviewed_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "perf_reviews_update" ON public.subcontractor_performance_reviews FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "perf_reviews_delete" ON public.subcontractor_performance_reviews FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
