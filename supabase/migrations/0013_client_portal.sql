-- =============================================================================
-- Nirmaan ERP — Migration 0013: Client-Specific Portal View & RLS Hardening
-- Adds client_id, client_approved, client_approved_at to public.projects.
-- Replaces existing SELECT policies on projects & project_documents with single
-- unified role-conditional policies.
-- Enforces client column update lock via BEFORE UPDATE trigger.
-- =============================================================================

-- 1. Alter public.projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_approved BOOLEAN DEFAULT false NOT NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);

-- 2. Unified Single-Policy RLS on public.projects
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select" ON public.projects;
DROP POLICY IF EXISTS "projects_select_client" ON public.projects;
DROP POLICY IF EXISTS "projects_insert" ON public.projects;
DROP POLICY IF EXISTS "projects_update" ON public.projects;
DROP POLICY IF EXISTS "projects_delete" ON public.projects;

-- Single unified SELECT policy: non-client roles see all; clients see ONLY linked project
CREATE POLICY "projects_select" ON public.projects FOR SELECT USING (
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff')))
  OR
  (client_id = auth.uid())
);

-- INSERT: Admin and PM only
CREATE POLICY "projects_insert" ON public.projects FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- UPDATE: Admin, PM, or Client updating own assigned project
CREATE POLICY "projects_update" ON public.projects FOR UPDATE USING (
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager')))
  OR
  (client_id = auth.uid())
);

-- DELETE: Admin only
CREATE POLICY "projects_delete" ON public.projects FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Column-Lock Trigger for Client Updates
CREATE OR REPLACE FUNCTION trg_guard_client_project_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  IF user_role = 'client' THEN
    -- Ensure client can ONLY modify client_approved and client_approved_at
    IF OLD.id IS DISTINCT FROM NEW.id OR
       OLD.name IS DISTINCT FROM NEW.name OR
       OLD.description IS DISTINCT FROM NEW.description OR
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.start_date IS DISTINCT FROM NEW.start_date OR
       OLD.end_date IS DISTINCT FROM NEW.end_date OR
       OLD.manager_id IS DISTINCT FROM NEW.manager_id OR
       OLD.client_id IS DISTINCT FROM NEW.client_id THEN
      RAISE EXCEPTION 'Client accounts are only authorized to sign off progress milestone fields.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_project_update ON public.projects;
CREATE TRIGGER trg_client_project_update
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION trg_guard_client_project_update();

-- 4. Unified Single-Policy RLS on public.project_documents
DROP POLICY IF EXISTS "project_documents_select" ON public.project_documents;
DROP POLICY IF EXISTS "project_documents_select_client" ON public.project_documents;

CREATE POLICY "project_documents_select" ON public.project_documents FOR SELECT USING (
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager', 'site_staff')))
  OR
  (
    category != 'contract' AND
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_documents.project_id AND client_id = auth.uid())
  )
);
