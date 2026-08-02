-- =============================================================================
-- Nirmaan ERP — Migration 0024: Punch List & Defect Tracking with Photo Annotation
-- =============================================================================

-- 1. Create ENUM types for punch items
DO $$ BEGIN
  CREATE TYPE public.punch_item_severity AS ENUM ('minor', 'moderate', 'major');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.punch_item_status AS ENUM ('open', 'in_progress', 'resolved', 'verified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create public.punch_items table
CREATE TABLE IF NOT EXISTS public.punch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_detail TEXT NOT NULL,
  severity public.punch_item_severity NOT NULL DEFAULT 'minor',
  status public.punch_item_status NOT NULL DEFAULT 'open',
  photo_path TEXT DEFAULT NULL,
  annotation_data JSONB DEFAULT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_punch_items_project_id ON public.punch_items(project_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_status ON public.punch_items(status);
CREATE INDEX IF NOT EXISTS idx_punch_items_created_by ON public.punch_items(created_by);
CREATE INDEX IF NOT EXISTS idx_punch_items_assigned_to ON public.punch_items(assigned_to);

-- 3. Row Level Security Policies on public.punch_items
ALTER TABLE public.punch_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "punch_items_select" ON public.punch_items;
DROP POLICY IF EXISTS "punch_items_insert" ON public.punch_items;
DROP POLICY IF EXISTS "punch_items_update" ON public.punch_items;
DROP POLICY IF EXISTS "punch_items_delete" ON public.punch_items;

-- SELECT Policy:
-- Admin, Project Manager, and Site Staff can view all punch items (shared QA list)
CREATE POLICY "punch_items_select" ON public.punch_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

-- INSERT Policy:
-- Admin, Project Manager, Site Staff can create punch items with status 'open'
CREATE POLICY "punch_items_insert" ON public.punch_items
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND status = 'open'
  AND EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

-- UPDATE Policy:
-- Admin and Project Manager can update any punch item; Site Staff can update items assigned to them or created by them
CREATE POLICY "punch_items_update" ON public.punch_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
  OR (
    (created_by = auth.uid() OR assigned_to = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users
       WHERE id = auth.uid()
         AND role = 'site_staff'
    )
  )
);

-- DELETE Policy:
-- Admin only
CREATE POLICY "punch_items_delete" ON public.punch_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role = 'admin'
  )
);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
