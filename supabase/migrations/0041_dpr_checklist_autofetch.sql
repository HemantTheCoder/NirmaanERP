-- =============================================================================
-- Nirmaan ERP — Migration 0041: Auto-fetch planned checklist items from tasks
-- =============================================================================
-- Today, filling a DPR checklist means retyping what's already sitting in
-- public.tasks as that project's plan for the day. This adds a trigger that
-- pre-populates dpr_checklist_items from matching tasks when a DPR is first
-- created, while leaving manual add/remove exactly as it works today — this
-- is additive, not a replacement. If zero tasks match (informal work, or a
-- project with nothing scheduled that day), the checklist simply stays empty,
-- same as before this migration.
--
-- task_id is nullable and ON DELETE SET NULL: deleting a checklist item never
-- deletes the task, and deleting a task never deletes DPR history — it just
-- orphans the link, same as every other "traced back to X" FK in this schema.

-- 1. Column + index
ALTER TABLE public.dpr_checklist_items
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dpr_checklist_task_id ON public.dpr_checklist_items(task_id);

COMMENT ON COLUMN public.dpr_checklist_items.task_id IS
  'Source task for an auto-fetched item; NULL for manually-added ad-hoc items (site cleanup, material delivery, etc.).';

-- 2. Auto-fetch trigger
--
-- "Was this task's work actually done TODAY" is a different question from
-- "is the task done overall" — a task can span several days across several
-- DPRs, so is_completed always starts false here regardless of the task's
-- own status. Part 1 step 4 (the opt-in "Also mark task as Done" action) is
-- the only thing allowed to push a change the other direction, and only when
-- a human clicks it.
CREATE OR REPLACE FUNCTION public.autofetch_dpr_checklist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.dpr_checklist_items (dpr_id, description, is_completed, task_id, sequence)
  SELECT
    NEW.id,
    t.title,
    false,
    t.id,
    ROW_NUMBER() OVER (ORDER BY t.priority DESC, t.due_date NULLS LAST)
  FROM public.tasks t
  WHERE t.project_id = NEW.project_id
    AND (
      (t.start_date IS NOT NULL AND t.start_date <= NEW.report_date
        AND (t.due_date IS NULL OR t.due_date >= NEW.report_date))
      OR (t.start_date IS NULL AND t.due_date = NEW.report_date)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autofetch_dpr_checklist ON public.daily_progress_reports;
CREATE TRIGGER trg_autofetch_dpr_checklist
AFTER INSERT ON public.daily_progress_reports
FOR EACH ROW EXECUTE FUNCTION public.autofetch_dpr_checklist();

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
