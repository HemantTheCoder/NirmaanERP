-- =============================================================================
-- Nirmaan ERP — Migration 0021: Fix resource_allocations RLS Insert Policy
-- Uses a SECURITY DEFINER helper to reliably check user role without subquery issues.
-- Enforces identity binding (requested_by = auth.uid()) AND authorized role.
-- =============================================================================

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

DROP POLICY IF EXISTS "resource_allocations_insert" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_insert_policy" ON public.resource_allocations;
DROP POLICY IF EXISTS "resource_allocations_insert_own" ON public.resource_allocations;

CREATE POLICY "resource_allocations_insert" ON public.resource_allocations
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND public.is_authorized_resource_requester(auth.uid())
);
