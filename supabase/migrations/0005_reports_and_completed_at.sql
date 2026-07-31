-- =============================================================================
-- Nirmaan ERP — Migration 0005: Reports & Task Completion Tracking
-- Adds updated_at & completed_at columns to tasks table, auto-completion trigger,
-- and backfills historical done tasks with COALESCE(updated_at, created_at).
-- =============================================================================

-- ── 1. Add Columns ────────────────────────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.tasks.updated_at IS 'Timestamp when the task was last modified';
COMMENT ON COLUMN public.tasks.completed_at IS 'Timestamp when the task was marked done';

-- Index for completion trend queries
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at) WHERE status = 'done';
CREATE INDEX IF NOT EXISTS idx_tasks_status_assignee ON public.tasks(status, assignee_id);

-- ── 2. Trigger Function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();

  -- If transition to 'done', stamp completed_at (preserve existing completed_at if present)
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at = now();
    END IF;
  -- If transition away from 'done', reset completed_at to NULL
  ELSIF NEW.status IS DISTINCT FROM 'done' THEN
    NEW.completed_at = NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_task_completed_at ON public.tasks;
CREATE TRIGGER trg_set_task_completed_at
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_task_completed_at();

-- ── 3. Backfill Existing Done Tasks ───────────────────────────────────────────
-- Use COALESCE(updated_at, created_at) instead of now() to prevent a false single-day spike

UPDATE public.tasks
SET completed_at = COALESCE(updated_at, created_at)
WHERE status = 'done' AND completed_at IS NULL;
