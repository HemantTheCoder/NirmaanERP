-- =============================================================================
-- Nirmaan ERP — Migration 0038: Project Delay Tracking & PPC Alerting
-- =============================================================================
-- Captures WHY a project slipped (reason is mandatory) and how long it took to
-- put right. A project has at most one OPEN delay at a time — once rectified it
-- is no longer "in delay" until a new one is reported.
--
-- Depends on migration 0037 for the notification_type enum values
-- ('delay_reported', 'delay_rectified', 'ppc_below_target').
-- =============================================================================

DO $$ BEGIN
  CREATE TYPE public.delay_status AS ENUM ('open', 'rectified');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.project_delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  dpr_id UUID REFERENCES public.daily_progress_reports(id) ON DELETE SET NULL,
  reported_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  status public.delay_status NOT NULL DEFAULT 'open',
  rectified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rectified_at TIMESTAMPTZ,
  rectification_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.project_delays IS 'Delay log per project. At most one open delay at a time (see idx_one_open_delay_per_project).';

-- A project can only be "in delay" for one reason at a time. The UI checks for
-- an existing open delay first and surfaces a friendly message; this index is
-- the backstop that keeps the invariant true under concurrent writes.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_open_delay_per_project
  ON public.project_delays(project_id)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_project_delays_project ON public.project_delays(project_id);
CREATE INDEX IF NOT EXISTS idx_project_delays_status ON public.project_delays(status);
CREATE INDEX IF NOT EXISTS idx_project_delays_reported_by ON public.project_delays(reported_by);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Report: site_staff (they witness delays first-hand), project_manager, admin.
-- Rectify: project_manager and admin only — closing a delay is a management
--          sign-off, so the UPDATE policy is deliberately narrower than INSERT.
-- View:    everyone with dashboard access, including clients.

ALTER TABLE public.project_delays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_delays_select" ON public.project_delays;
DROP POLICY IF EXISTS "project_delays_insert" ON public.project_delays;
DROP POLICY IF EXISTS "project_delays_update" ON public.project_delays;
DROP POLICY IF EXISTS "project_delays_delete" ON public.project_delays;

CREATE POLICY "project_delays_select" ON public.project_delays
FOR SELECT TO authenticated USING (true);

CREATE POLICY "project_delays_insert" ON public.project_delays
FOR INSERT TO authenticated WITH CHECK (
  reported_by = auth.uid()
  AND status = 'open'
  AND EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

CREATE POLICY "project_delays_update" ON public.project_delays
FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

CREATE POLICY "project_delays_delete" ON public.project_delays
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ── Auto-Notification: Delay Reported ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_delay_reported()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  proj RECORD;
BEGIN
  SELECT name, manager_id INTO proj FROM public.projects WHERE id = NEW.project_id;

  -- Project manager (unless they reported it themselves) plus all admins
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT
    u.id,
    'delay_reported'::notification_type,
    'Delay reported on "' || proj.name || '": ' || NEW.reason,
    '/projects/' || NEW.project_id::TEXT
  FROM public.users u
  WHERE (u.id = proj.manager_id OR u.role = 'admin')
    AND u.id IS DISTINCT FROM NEW.reported_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_delay_reported ON public.project_delays;
CREATE TRIGGER trg_notify_delay_reported
AFTER INSERT ON public.project_delays
FOR EACH ROW EXECUTE FUNCTION public.notify_delay_reported();

-- ── Auto-Notification: Delay Rectified ───────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_delay_rectified()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  proj_name TEXT;
BEGIN
  IF OLD.status = 'open' AND NEW.status = 'rectified' THEN
    SELECT name INTO proj_name FROM public.projects WHERE id = NEW.project_id;

    -- Whoever reported it, plus all admins
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT
      u.id,
      'delay_rectified'::notification_type,
      'Delay on "' || proj_name || '" reported ' || TO_CHAR(NEW.reported_date, 'DD Mon YYYY')
        || ' has been rectified: ' || COALESCE(NEW.rectification_notes, 'no notes provided'),
      '/projects/' || NEW.project_id::TEXT
    FROM public.users u
    WHERE (u.id = NEW.reported_by OR u.role = 'admin')
      AND u.id IS DISTINCT FROM NEW.rectified_by;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_delay_rectified ON public.project_delays;
CREATE TRIGGER trg_notify_delay_rectified
AFTER UPDATE OF status ON public.project_delays
FOR EACH ROW EXECUTE FUNCTION public.notify_delay_rectified();

-- ── Auto-Notification: PPC Below Target ──────────────────────────────────────
-- Fires as checklist items are ticked. The threshold lives here, once, as a
-- single named constant — mirrored (read-only) as PPC_TARGET_PERCENT in
-- lib/queries/dpr.ts purely for UI colouring. Change it here first.
--
-- Guarded so it alerts on the transition below target rather than on every
-- subsequent tick: it only fires when this update is what pushed the report
-- under the line, and only once per report per day.

CREATE OR REPLACE FUNCTION public.notify_ppc_below_target()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ppc_target CONSTANT NUMERIC := 80;  -- PPC alert threshold (percent)
  total_items INTEGER;
  done_items INTEGER;
  ppc NUMERIC;
  dpr RECORD;
  proj RECORD;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed)
    INTO total_items, done_items
    FROM public.dpr_checklist_items
   WHERE dpr_id = COALESCE(NEW.dpr_id, OLD.dpr_id);

  -- No checklist means no plan recorded — nothing to measure against
  IF total_items = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  ppc := ROUND((done_items::NUMERIC * 100) / total_items, 1);

  IF ppc >= ppc_target THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id, project_id, report_date INTO dpr
    FROM public.daily_progress_reports
   WHERE id = COALESCE(NEW.dpr_id, OLD.dpr_id);

  SELECT name, manager_id INTO proj FROM public.projects WHERE id = dpr.project_id;

  -- Only alert once per report — re-ticking items shouldn't re-notify
  IF EXISTS (
    SELECT 1 FROM public.notifications
     WHERE type = 'ppc_below_target'
       AND link = '/projects/' || dpr.project_id::TEXT
       AND message LIKE '%' || TO_CHAR(dpr.report_date, 'DD Mon YYYY') || '%'
  ) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT
    u.id,
    'ppc_below_target'::notification_type,
    'PPC for "' || proj.name || '" on ' || TO_CHAR(dpr.report_date, 'DD Mon YYYY')
      || ' was ' || ppc::TEXT || '% — below the ' || ppc_target::TEXT || '% target',
    '/projects/' || dpr.project_id::TEXT
  FROM public.users u
  WHERE u.id = proj.manager_id OR u.role = 'admin';

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_ppc_below_target ON public.dpr_checklist_items;
CREATE TRIGGER trg_notify_ppc_below_target
AFTER INSERT OR UPDATE OF is_completed OR DELETE ON public.dpr_checklist_items
FOR EACH ROW EXECUTE FUNCTION public.notify_ppc_below_target();

NOTIFY pgrst, 'reload schema';
