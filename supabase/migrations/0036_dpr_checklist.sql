-- =============================================================================
-- Nirmaan ERP — Migration 0036: DPR Planned-vs-Actual Checklist (PPC)
-- =============================================================================
-- Adds a structured checklist layer to daily_progress_reports so a site engineer
-- can list what was PLANNED for the day as individual line items, then check off
-- what was actually COMPLETED. This is what PPC (Percent Plan Complete) is
-- computed from.
--
-- The existing daily_progress_reports.work_completed free-text column is left
-- untouched — it remains the narrative summary. The checklist is the structured
-- layer used for metrics.
--
-- PPC itself is deliberately NOT a generated column: it must return NULL (not a
-- divide-by-zero error) when a report has no checklist items, so it is computed
-- in the query layer (lib/queries/dpr.ts) and in the alerting trigger.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.dpr_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dpr_id UUID NOT NULL REFERENCES public.daily_progress_reports(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.dpr_checklist_items IS 'Planned work line items for a DPR; is_completed drives the PPC (Percent Plan Complete) metric.';

CREATE INDEX IF NOT EXISTS idx_dpr_checklist_dpr_id ON public.dpr_checklist_items(dpr_id);
CREATE INDEX IF NOT EXISTS idx_dpr_checklist_completed ON public.dpr_checklist_items(dpr_id, is_completed);

-- ── Row Level Security ───────────────────────────────────────────────────────
-- Mirrors the parent daily_progress_reports policies: access to a checklist item
-- follows access to the DPR it belongs to.

ALTER TABLE public.dpr_checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dpr_checklist_select" ON public.dpr_checklist_items;
DROP POLICY IF EXISTS "dpr_checklist_insert" ON public.dpr_checklist_items;
DROP POLICY IF EXISTS "dpr_checklist_update" ON public.dpr_checklist_items;
DROP POLICY IF EXISTS "dpr_checklist_delete" ON public.dpr_checklist_items;

-- SELECT: same audience as the parent DPR
CREATE POLICY "dpr_checklist_select" ON public.dpr_checklist_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

-- INSERT: only onto a DPR the caller may still edit (own same-day report, or admin/PM)
CREATE POLICY "dpr_checklist_insert" ON public.dpr_checklist_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.daily_progress_reports d
     WHERE d.id = dpr_id
       AND (
         (d.submitted_by = auth.uid() AND d.report_date = CURRENT_DATE)
         OR EXISTS (
           SELECT 1 FROM public.users
            WHERE id = auth.uid()
              AND role IN ('admin', 'project_manager')
         )
       )
  )
);

-- UPDATE: ticking items off, same edit window as INSERT
CREATE POLICY "dpr_checklist_update" ON public.dpr_checklist_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.daily_progress_reports d
     WHERE d.id = dpr_id
       AND (
         (d.submitted_by = auth.uid() AND d.report_date = CURRENT_DATE)
         OR EXISTS (
           SELECT 1 FROM public.users
            WHERE id = auth.uid()
              AND role IN ('admin', 'project_manager')
         )
       )
  )
);

-- DELETE: removing a planned item, same edit window
CREATE POLICY "dpr_checklist_delete" ON public.dpr_checklist_items
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.daily_progress_reports d
     WHERE d.id = dpr_id
       AND (
         (d.submitted_by = auth.uid() AND d.report_date = CURRENT_DATE)
         OR EXISTS (
           SELECT 1 FROM public.users
            WHERE id = auth.uid()
              AND role IN ('admin', 'project_manager')
         )
       )
  )
);

NOTIFY pgrst, 'reload schema';
