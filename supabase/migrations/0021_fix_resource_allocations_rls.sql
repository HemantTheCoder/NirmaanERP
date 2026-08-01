-- =============================================================================
-- Nirmaan ERP — Migration 0021: Fix resource_allocations RLS Insert Policy
-- Enforces identity binding (requested_by = auth.uid()) AND authorized role.
-- =============================================================================

DROP POLICY IF EXISTS "resource_allocations_insert" ON public.resource_allocations;

CREATE POLICY "resource_allocations_insert" ON public.resource_allocations FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);
