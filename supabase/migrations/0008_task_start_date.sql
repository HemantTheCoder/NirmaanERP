-- =============================================================================
-- Nirmaan ERP — Migration 0008: Task Start Date for Gantt Timeline
-- Adds start_date column to public.tasks and backfills existing rows.
-- =============================================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS start_date DATE;

COMMENT ON COLUMN public.tasks.start_date IS 'Start date of the task for Gantt timeline rendering.';

-- Backfill existing null start_date values with created_at date
UPDATE public.tasks
  SET start_date = created_at::date
  WHERE start_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON public.tasks(start_date);
