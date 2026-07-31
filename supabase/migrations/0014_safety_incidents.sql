-- =============================================================================
-- Nirmaan ERP — Migration 0014: Safety Incident & Near-Miss Reporting
-- Creates incident_type, incident_severity, incident_status enums,
-- safety_incidents table, RLS policies, and DB triggers for immediate critical
-- alerts and status/assignee notifications.
-- =============================================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE incident_type AS ENUM ('near_miss', 'incident');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE incident_status AS ENUM ('reported', 'under_review', 'action_taken', 'closed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Table safety_incidents
CREATE TABLE IF NOT EXISTS public.safety_incidents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  incident_type incident_type NOT NULL DEFAULT 'near_miss',
  severity incident_severity NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_detail TEXT NOT NULL,
  corrective_action TEXT,
  status incident_status NOT NULL DEFAULT 'reported',
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.safety_incidents IS 'Tracks site near-misses, hazards, and safety incidents across all projects.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_safety_incidents_reported_by ON public.safety_incidents(reported_by);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_project ON public.safety_incidents(project_id);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_severity ON public.safety_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_safety_incidents_status ON public.safety_incidents(status);

-- 3. Enable RLS
ALTER TABLE public.safety_incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "safety_incidents_select" ON public.safety_incidents;
DROP POLICY IF EXISTS "safety_incidents_insert" ON public.safety_incidents;
DROP POLICY IF EXISTS "safety_incidents_update" ON public.safety_incidents;
DROP POLICY IF EXISTS "safety_incidents_delete" ON public.safety_incidents;

-- SELECT: Reporter can view own; Admin / PM can view all
CREATE POLICY "safety_incidents_select" ON public.safety_incidents FOR SELECT USING (
  reported_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- INSERT: Any authenticated user (including clients) with status = 'reported'
CREATE POLICY "safety_incidents_insert" ON public.safety_incidents FOR INSERT WITH CHECK (
  reported_by = auth.uid() AND (
    status = 'reported' OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
  )
);

-- UPDATE: Admin / PM only
CREATE POLICY "safety_incidents_update" ON public.safety_incidents FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- DELETE: Admin only
CREATE POLICY "safety_incidents_delete" ON public.safety_incidents FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 4. Immediate Critical Incident Alert Trigger (AFTER INSERT)
CREATE OR REPLACE FUNCTION notify_critical_safety_incident()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.severity = 'critical' THEN
    -- Immediately notify all admin and project manager users
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT
      id,
      'safety',
      '🚨 CRITICAL SAFETY ALERT: "' || NEW.title || '" reported at ' || NEW.location_detail,
      '/safety'
    FROM public.users
    WHERE role IN ('admin', 'project_manager');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_critical_safety ON public.safety_incidents;
CREATE TRIGGER trg_notify_critical_safety
AFTER INSERT ON public.safety_incidents
FOR EACH ROW
EXECUTE FUNCTION notify_critical_safety_incident();

-- 5. Status & Assignee Change Trigger (AFTER UPDATE)
CREATE OR REPLACE FUNCTION notify_safety_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Notify reporter when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.reported_by,
      'safety',
      'Your safety report "' || NEW.title || '" status updated to ' || replace(NEW.status::text, '_', ' '),
      '/safety'
    );
  END IF;

  -- Notify assignee when assigned_to changes
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.assigned_to,
      'safety',
      'You have been assigned to resolve safety report "' || NEW.title || '"',
      '/safety'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_safety_events ON public.safety_incidents;
CREATE TRIGGER trg_notify_safety_events
AFTER UPDATE ON public.safety_incidents
FOR EACH ROW
EXECUTE FUNCTION notify_safety_events();
