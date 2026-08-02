-- =============================================================================
-- Nirmaan ERP — Migration 0025: Daily Progress Reports (DPR)
-- =============================================================================

-- 1. Create ENUM type for weather condition
DO $$ BEGIN
  CREATE TYPE public.weather_condition AS ENUM (
    'clear',
    'rain',
    'overcast',
    'extreme_heat',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create public.daily_progress_reports table
CREATE TABLE IF NOT EXISTS public.daily_progress_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  weather public.weather_condition NOT NULL DEFAULT 'clear',
  manpower_count INTEGER NOT NULL CHECK (manpower_count >= 0),
  equipment_used TEXT NOT NULL,
  work_completed TEXT NOT NULL,
  delays_encountered TEXT DEFAULT NULL,
  photos_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint: Only one DPR per project per day
  CONSTRAINT unique_project_report_date UNIQUE (project_id, report_date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dpr_project_id ON public.daily_progress_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_dpr_report_date ON public.daily_progress_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_dpr_submitted_by ON public.daily_progress_reports(submitted_by);

-- 3. Row Level Security Policies on public.daily_progress_reports
ALTER TABLE public.daily_progress_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpr_select" ON public.daily_progress_reports;
DROP POLICY IF EXISTS "dpr_insert" ON public.daily_progress_reports;
DROP POLICY IF EXISTS "dpr_update" ON public.daily_progress_reports;
DROP POLICY IF EXISTS "dpr_delete" ON public.daily_progress_reports;

-- SELECT Policy:
-- Admin, Project Manager, Site Staff can view all DPRs for accessible projects
CREATE POLICY "dpr_select" ON public.daily_progress_reports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

-- INSERT Policy:
-- Admin, PM, Site Staff can insert DPRs for today
CREATE POLICY "dpr_insert" ON public.daily_progress_reports
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

-- UPDATE Policy:
-- Only allow updating same-day reports by submitted_by or Admin/PM (cannot rewrite history)
CREATE POLICY "dpr_update" ON public.daily_progress_reports
FOR UPDATE USING (
  (
    submitted_by = auth.uid()
    AND report_date = CURRENT_DATE
  )
  OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- DELETE Policy:
-- Admin only
CREATE POLICY "dpr_delete" ON public.daily_progress_reports
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role = 'admin'
  )
);

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
