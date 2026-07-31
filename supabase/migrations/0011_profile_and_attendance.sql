-- =============================================================================
-- Nirmaan ERP — Migration 0011: Profile & Attendance (My Workspace Additions)
-- Adds phone & avatar_url to users, column-level UPDATE security, attendance
-- unique constraint, server-side status trigger, and avatars storage bucket RLS.
-- =============================================================================

-- 1. Alter public.users: Add phone & avatar_url
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Prevent self-role elevation at DB level using column-level privileges
REVOKE UPDATE ON public.users FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url) ON public.users TO authenticated;

-- Ensure users UPDATE policy exists
DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (
  id = auth.uid()
);

-- 2. Attendance Table Security & Unique Constraint
DO $$ BEGIN
  ALTER TABLE public.attendance ADD CONSTRAINT unique_user_daily_attendance UNIQUE (user_id, date);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN null;
END $$;

-- Server-side Trigger Function for 9:30 AM Cutoff Status
CREATE OR REPLACE FUNCTION trg_compute_attendance_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Compute status automatically based on check_in time (cutoff 09:30:00)
  IF NEW.check_in::time > '09:30:00'::time THEN
    NEW.status := 'late';
  ELSE
    NEW.status := 'present';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_attendance_status ON public.attendance;
CREATE TRIGGER trg_set_attendance_status
BEFORE INSERT ON public.attendance
FOR EACH ROW
EXECUTE FUNCTION trg_compute_attendance_status();

-- Attendance RLS Policies
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_select" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert" ON public.attendance;
DROP POLICY IF EXISTS "attendance_update" ON public.attendance;

CREATE POLICY "attendance_select" ON public.attendance FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

CREATE POLICY "attendance_insert" ON public.attendance FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

CREATE POLICY "attendance_update" ON public.attendance FOR UPDATE USING (
  user_id = auth.uid()
);

-- 3. Create Public Storage Bucket 'avatars'
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Folder-Scoped Storage RLS for avatars bucket ({auth.uid()}/...)
DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;

-- Public SELECT for avatars
CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'avatars'
);

-- Folder-restricted INSERT/UPDATE/DELETE
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
