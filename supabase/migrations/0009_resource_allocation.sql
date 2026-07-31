-- =============================================================================
-- Nirmaan ERP — Migration 0009: Resource Allocation Tracking
-- Adds resource_type and resource_status enums, resource_allocations table,
-- and RLS policies guarding INSERT status and UPDATE permissions.
-- =============================================================================

-- 1. Create Enums
DO $$ BEGIN
  CREATE TYPE resource_type AS ENUM ('material', 'equipment', 'labor');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE resource_status AS ENUM ('requested', 'approved', 'in_use', 'released', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table resource_allocations
CREATE TABLE IF NOT EXISTS public.resource_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  resource_type resource_type NOT NULL,
  resource_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit TEXT NOT NULL,
  status resource_status NOT NULL DEFAULT 'requested',
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  requested_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.resource_allocations IS 'Tracks project material, equipment, and labor allocations and approvals.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_resource_allocations_project ON public.resource_allocations(project_id);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_status ON public.resource_allocations(status);
CREATE INDEX IF NOT EXISTS idx_resource_allocations_requested_by ON public.resource_allocations(requested_by);

-- 3. Enable RLS
ALTER TABLE public.resource_allocations ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "resource_allocations_select" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_insert" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_update" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_delete" ON public.resource_allocations;

-- Authenticated users can view resource allocations
CREATE POLICY "resource_allocations_select" ON public.resource_allocations FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Users can insert resource requests for themselves; non-approvers MUST insert with status = 'requested'
CREATE POLICY "resource_allocations_insert" ON public.resource_allocations FOR INSERT WITH CHECK (
  requested_by = auth.uid() AND (
    status = 'requested' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
  )
);

-- Only admin and project_manager can update status or approved_by
CREATE POLICY "resource_allocations_update" ON public.resource_allocations FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- Only admin can delete resource allocations
CREATE POLICY "resource_allocations_delete" ON public.resource_allocations FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
