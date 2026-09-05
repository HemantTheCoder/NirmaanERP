-- =============================================================================
-- Nirmaan ERP — Migration 0051: Warranty / Close-Out
-- =============================================================================
-- Nothing today tracks a project after handover. This adds:
--   1. projects.warranty_end_date — the warranty period staff can set.
--   2. warranty_claims — post-handover defect claims, reusing the same
--      photo + pin-annotation format as punch_items, but unlike punch_items
--      (staff-only) a client can raise a claim themselves on their own
--      linked project, since they're the one who lives in the building.
--   3. 'om_manual' document category — the O&M manual repository, which
--      doesn't need a new table at all: it's just another category on the
--      existing project_documents infrastructure.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS warranty_end_date DATE;

ALTER TYPE public.document_category ADD VALUE IF NOT EXISTS 'om_manual';

DO $$ BEGIN
  CREATE TYPE public.warranty_claim_status AS ENUM ('submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_detail TEXT NOT NULL,
  photo_path TEXT,
  annotation_data JSONB,
  status public.warranty_claim_status NOT NULL DEFAULT 'submitted',
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

COMMENT ON TABLE public.warranty_claims IS
  'Post-handover defect claims. Unlike punch_items, a client can raise these directly on their own linked project.';

CREATE INDEX IF NOT EXISTS idx_warranty_claims_project ON public.warranty_claims(project_id);
CREATE INDEX IF NOT EXISTS idx_warranty_claims_status ON public.warranty_claims(status);

ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warranty_claims_select" ON public.warranty_claims;
DROP POLICY IF EXISTS "warranty_claims_insert" ON public.warranty_claims;
DROP POLICY IF EXISTS "warranty_claims_update" ON public.warranty_claims;
DROP POLICY IF EXISTS "warranty_claims_delete" ON public.warranty_claims;

-- SELECT: staff see every claim; a client sees only claims on their own
-- linked project (same client_id-scoping pattern as 0046/0050).
CREATE POLICY "warranty_claims_select" ON public.warranty_claims
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = warranty_claims.project_id AND p.client_id = auth.uid())
);

-- INSERT: staff on any project, OR the client themselves on their own
-- linked project — both always as reported_by = auth.uid().
CREATE POLICY "warranty_claims_insert" ON public.warranty_claims
FOR INSERT TO authenticated WITH CHECK (
  reported_by = auth.uid()
  AND status = 'submitted'
  AND (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = warranty_claims.project_id AND p.client_id = auth.uid())
  )
);

-- UPDATE (acknowledge/resolve/reject/assign): staff only — a client can
-- report a defect but not close it out themselves.
CREATE POLICY "warranty_claims_update" ON public.warranty_claims FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff'))
);

CREATE POLICY "warranty_claims_delete" ON public.warranty_claims FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

NOTIFY pgrst, 'reload schema';
