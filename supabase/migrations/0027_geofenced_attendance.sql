-- =============================================================================
-- Nirmaan ERP — Migration 0027: GPS-Geofenced Attendance Check-In
-- =============================================================================

-- 1. Add site coordinates & geofence radius to public.projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS site_latitude NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS site_longitude NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS geofence_radius_meters INTEGER DEFAULT 250;

-- 2. Add geofence audit columns to public.attendance
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS check_in_latitude NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_in_longitude NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_in_within_geofence BOOLEAN DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS check_in_distance_meters INTEGER DEFAULT NULL;

-- Indexes for geofence audit querying
CREATE INDEX IF NOT EXISTS idx_attendance_within_geofence ON public.attendance(check_in_within_geofence);

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
