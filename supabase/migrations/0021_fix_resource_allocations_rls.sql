-- =============================================================================
-- Nirmaan ERP — Migration 0021: Fix resource_allocations RLS Insert Policy
-- =============================================================================

DROP POLICY IF EXISTS "resource_allocations_insert" ON public.resource_allocations;

-- Allow admin, project_manager, and site_staff to insert resource requests & allocations
-- Explicitly blocks client and contractor roles.
CREATE POLICY "resource_allocations_insert" ON public.resource_allocations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);
