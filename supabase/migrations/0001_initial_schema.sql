-- =============================================================================
-- Nirmaan ERP — Initial Database Schema
-- Run this in your Supabase SQL Editor or via the Supabase CLI:
--   supabase db push
-- =============================================================================

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('admin', 'project_manager', 'site_staff', 'client');

CREATE TYPE project_status AS ENUM ('planning', 'active', 'on_hold', 'completed');

CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');

CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'half_day', 'on_leave');

CREATE TYPE leave_type AS ENUM ('casual', 'sick', 'earned', 'unpaid');

CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected');

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Mirrors auth.users — stores role and profile data

CREATE TABLE IF NOT EXISTS public.users (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL UNIQUE,
  full_name   TEXT,
  role        user_role   NOT NULL DEFAULT 'site_staff',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS 'Extended user profiles — mirrors auth.users';

-- ── Projects ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id          UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT          NOT NULL,
  description TEXT,
  status      project_status NOT NULL DEFAULT 'planning',
  start_date  DATE,
  end_date    DATE,
  manager_id  UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.projects IS 'Construction projects';

-- ── Tasks ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tasks (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT          NOT NULL,
  description  TEXT,
  status       task_status   NOT NULL DEFAULT 'todo',
  priority     task_priority NOT NULL DEFAULT 'medium',
  project_id   UUID          REFERENCES public.projects(id) ON DELETE CASCADE,
  assignee_id  UUID          REFERENCES public.users(id) ON DELETE SET NULL,
  due_date     DATE,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.tasks IS 'Project tasks and work items';

-- ── Attendance ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.attendance (
  id          UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date        DATE              NOT NULL,
  check_in    TIME,
  check_out   TIME,
  status      attendance_status NOT NULL DEFAULT 'present',
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

COMMENT ON TABLE public.attendance IS 'Daily attendance records for site staff';

-- ── Leaves ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leaves (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID         NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_date   DATE         NOT NULL,
  end_date     DATE         NOT NULL,
  type         leave_type   NOT NULL DEFAULT 'casual',
  status       leave_status NOT NULL DEFAULT 'pending',
  reason       TEXT,
  approved_by  UUID         REFERENCES public.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.leaves IS 'Leave applications and approvals';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_project_id   ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id  ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_id ON public.attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date    ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_leaves_user_id     ON public.leaves(user_id);
CREATE INDEX IF NOT EXISTS idx_leaves_status      ON public.leaves(status);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.users      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaves     ENABLE ROW LEVEL SECURITY;

-- users: anyone can read; only the owner can update their own row; admin can do anything
CREATE POLICY "users_select_all"    ON public.users FOR SELECT USING (true);
CREATE POLICY "users_update_own"    ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "users_insert_own"    ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- projects: authenticated users can read; project manager or admin can write
CREATE POLICY "projects_select"     ON public.projects FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "projects_insert"     ON public.projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);
CREATE POLICY "projects_update"     ON public.projects FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);
CREATE POLICY "projects_delete"     ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- tasks: authenticated users can read; assignee or manager can update; admin can delete
CREATE POLICY "tasks_select"        ON public.tasks FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "tasks_insert"        ON public.tasks FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "tasks_update"        ON public.tasks FOR UPDATE USING (
  assignee_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);
CREATE POLICY "tasks_delete"        ON public.tasks FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- attendance: users see their own; admin/pm see all
CREATE POLICY "attendance_select"   ON public.attendance FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);
CREATE POLICY "attendance_insert"   ON public.attendance FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "attendance_update"   ON public.attendance FOR UPDATE USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- leaves: users manage their own; admin/pm approve
CREATE POLICY "leaves_select"       ON public.leaves FOR SELECT USING (
  user_id = auth.uid() OR approved_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);
CREATE POLICY "leaves_insert"       ON public.leaves FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "leaves_update"       ON public.leaves FOR UPDATE USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);
CREATE POLICY "leaves_delete"       ON public.leaves FOR DELETE USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ── Trigger: auto-insert user profile on signup ───────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    COALESCE((new.raw_user_meta_data ->> 'role')::user_role, 'site_staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
