-- =============================================================================
-- Nirmaan ERP — Migration 0012: Grievances & Issue Reporting
-- Creates grievance_category & grievance_status enums, grievances table,
-- RLS policies, and DB triggers for status & assignment notifications.
-- =============================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE grievance_category AS ENUM ('safety', 'hr', 'equipment', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE grievance_status AS ENUM ('open', 'in_progress', 'resolved', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Table grievances
CREATE TABLE IF NOT EXISTS public.grievances (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  submitted_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category grievance_category NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status grievance_status NOT NULL DEFAULT 'open',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

COMMENT ON TABLE public.grievances IS 'Tracks safety, HR, equipment, and general grievances across all roles.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_grievances_submitted_by ON public.grievances(submitted_by);
CREATE INDEX IF NOT EXISTS idx_grievances_status ON public.grievances(status);
CREATE INDEX IF NOT EXISTS idx_grievances_category ON public.grievances(category);

-- 3. Enable RLS
ALTER TABLE public.grievances ENABLE ROW LEVEL SECURITY;

-- Table RLS Policies
DROP POLICY IF EXISTS "grievances_select" ON public.grievances;
DROP POLICY IF EXISTS "grievances_insert" ON public.grievances;
DROP POLICY IF EXISTS "grievances_update" ON public.grievances;
DROP POLICY IF EXISTS "grievances_delete" ON public.grievances;

-- SELECT: Submitter can view own; Admin / PM can view all
CREATE POLICY "grievances_select" ON public.grievances FOR SELECT USING (
  submitted_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- INSERT: Authenticated users can insert for themselves with status = 'open'
CREATE POLICY "grievances_insert" ON public.grievances FOR INSERT WITH CHECK (
  submitted_by = auth.uid() AND (
    status = 'open' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
  )
);

-- UPDATE: Admin / PM can update status, assigned_to, resolution_notes
CREATE POLICY "grievances_update" ON public.grievances FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- DELETE: Admin only
CREATE POLICY "grievances_delete" ON public.grievances FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Notification Trigger Functions
CREATE OR REPLACE FUNCTION notify_grievance_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify submitter if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.submitted_by,
      'grievance',
      'Your reported issue "' || NEW.title || '" status changed to ' || replace(NEW.status::text, '_', ' '),
      '/grievances'
    );
  END IF;

  -- Notify assignee if assigned_to changed
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.assigned_to,
      'grievance',
      'You have been assigned to resolve grievance "' || NEW.title || '"',
      '/grievances'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_grievance_events ON public.grievances;
CREATE TRIGGER trg_notify_grievance_events
AFTER UPDATE ON public.grievances
FOR EACH ROW
EXECUTE FUNCTION notify_grievance_events();
