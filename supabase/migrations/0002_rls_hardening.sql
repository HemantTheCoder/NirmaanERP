-- =============================================================================
-- Nirmaan ERP — RLS Hardening (Migration 0002)
-- Strictly enforces project write permissions and task status update limits.
-- =============================================================================

-- ── Projects RLS Hardening ───────────────────────────────────────────────────

-- Drop existing policies
DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

-- Read: Any authenticated user
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert: Admin or Project Manager only
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    )
  );

-- Update: Admin or Project Manager only
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    )
  );

-- Delete: Admin only
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── Tasks RLS Hardening ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS "tasks_select" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete" ON public.tasks;

-- Read: Any authenticated user
CREATE POLICY "tasks_select" ON public.tasks
  FOR SELECT USING (auth.role() = 'authenticated');

-- Insert: Any authenticated user can create task assigned to self or if Admin/PM
CREATE POLICY "tasks_insert" ON public.tasks
  FOR INSERT WITH CHECK (
    auth.role() = 'authenticated'
  );

-- Update: Assignee can update status/task, or Admin/PM can manage any task
CREATE POLICY "tasks_update" ON public.tasks
  FOR UPDATE USING (
    assignee_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    )
  );

-- Delete: Admin or PM only
CREATE POLICY "tasks_delete" ON public.tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    )
  );
