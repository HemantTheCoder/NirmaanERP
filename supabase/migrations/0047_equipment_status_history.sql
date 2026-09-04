-- =============================================================================
-- Nirmaan ERP — Migration 0047: Equipment Status History (for utilization %)
-- =============================================================================
-- equipment_assets.status is a snapshot — it can't tell you how long a crane
-- has actually spent in_use vs sitting idle. This adds an append-only log of
-- every status transition, written by a trigger (not client inserts), so
-- utilization % can be computed from real elapsed time instead of a point-in-
-- time guess.

CREATE TABLE IF NOT EXISTS public.equipment_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES public.equipment_assets(id) ON DELETE CASCADE,
  status public.equipment_status NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.equipment_status_history IS
  'Append-only log of equipment_assets.status transitions, written only by trg_equipment_status_history — utilization % is derived from elapsed time between rows.';

CREATE INDEX IF NOT EXISTS idx_equipment_status_history_equipment
  ON public.equipment_status_history(equipment_id, changed_at);

-- Trigger: log every insert (initial status) and status change
CREATE OR REPLACE FUNCTION public.log_equipment_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO public.equipment_status_history (equipment_id, status, changed_at, changed_by)
    VALUES (NEW.id, NEW.status, NEW.created_at, NEW.created_by);
  ELSIF (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status) THEN
    INSERT INTO public.equipment_status_history (equipment_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_equipment_status_history ON public.equipment_assets;
CREATE TRIGGER trg_equipment_status_history
AFTER INSERT OR UPDATE ON public.equipment_assets
FOR EACH ROW EXECUTE FUNCTION public.log_equipment_status_change();

-- Backfill: give every pre-existing asset a starting row at its current
-- status, dated to when it was created — otherwise utilization has no
-- history to compute from until its next status change.
INSERT INTO public.equipment_status_history (equipment_id, status, changed_at, changed_by)
SELECT id, status, created_at, created_by
FROM public.equipment_assets ea
WHERE NOT EXISTS (
  SELECT 1 FROM public.equipment_status_history h WHERE h.equipment_id = ea.id
);

-- Row Level Security — read-only for clients; all writes go through the
-- SECURITY DEFINER trigger above, so no insert/update/delete policy is
-- granted (a client forging history would corrupt the utilization numbers).
ALTER TABLE public.equipment_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "equipment_status_history_select" ON public.equipment_status_history;
CREATE POLICY "equipment_status_history_select" ON public.equipment_status_history FOR SELECT TO authenticated USING (true);

NOTIFY pgrst, 'reload schema';
