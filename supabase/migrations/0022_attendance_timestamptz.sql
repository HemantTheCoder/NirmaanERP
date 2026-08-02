-- =============================================================================
-- Nirmaan ERP — Migration 0022: Attendance TIMESTAMPTZ Column Migration
-- =============================================================================

-- 0. Extend attendance_status enum with 'late'
ALTER TYPE public.attendance_status ADD VALUE IF NOT EXISTS 'late';

-- 1. Alter check_in and check_out column types to TIMESTAMPTZ using (date + time)
ALTER TABLE public.attendance
  ALTER COLUMN check_in TYPE TIMESTAMPTZ USING (CASE WHEN check_in IS NOT NULL THEN (date + check_in) AT TIME ZONE 'Asia/Kolkata' ELSE NULL END),
  ALTER COLUMN check_out TYPE TIMESTAMPTZ USING (CASE WHEN check_out IS NOT NULL THEN (date + check_out) AT TIME ZONE 'Asia/Kolkata' ELSE NULL END);

-- 2. Update 9:30 AM IST cutoff status calculation trigger
CREATE OR REPLACE FUNCTION trg_compute_attendance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.check_in IS NOT NULL THEN
    -- Extract time-of-day in Asia/Kolkata (IST) and compare with 09:30:00
    IF (NEW.check_in AT TIME ZONE 'Asia/Kolkata')::time > '09:30:00'::time THEN
      NEW.status := 'late';
    ELSE
      NEW.status := 'present';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_attendance_status ON public.attendance;
CREATE TRIGGER trg_set_attendance_status
BEFORE INSERT OR UPDATE ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION trg_compute_attendance_status();

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
