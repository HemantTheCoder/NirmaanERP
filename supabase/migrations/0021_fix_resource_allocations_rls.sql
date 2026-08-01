-- =============================================================================
-- Nirmaan ERP — Migration 0021: Clean Purge & Fix resource_allocations RLS Policies
-- =============================================================================

-- 1. Create SECURITY DEFINER helper function for role verification
CREATE OR REPLACE FUNCTION public.is_authorized_resource_requester(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
     WHERE id = user_id
       AND role IN ('admin', 'project_manager', 'site_staff')
  );
$$;

-- 2. Dynamically drop ALL existing policies on resource_allocations to clear legacy/ghost policies
DO $$ 
DECLARE 
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'resource_allocations') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.resource_allocations;', r.policyname);
    END LOOP;
END $$;

-- 3. Re-create clean policies:

-- SELECT: Authenticated users can view resource allocations
CREATE POLICY "resource_allocations_select" ON public.resource_allocations
FOR SELECT USING (auth.role() = 'authenticated');

-- INSERT: Identity binding (requested_by = auth.uid()) AND authorized role
CREATE POLICY "resource_allocations_insert" ON public.resource_allocations
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND public.is_authorized_resource_requester(auth.uid())
);

-- UPDATE: Admin & Project Manager can manage status/approved_by
CREATE POLICY "resource_allocations_update" ON public.resource_allocations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- DELETE: Admin only
CREATE POLICY "resource_allocations_delete" ON public.resource_allocations
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role = 'admin'
  )
);
