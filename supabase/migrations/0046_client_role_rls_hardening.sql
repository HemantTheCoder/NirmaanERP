-- =============================================================================
-- Nirmaan ERP — Migration 0046: Client-Role RLS Hardening
-- =============================================================================
-- Closes three gaps in the client role's data boundary ahead of onboarding the
-- first real external client login. The client_id-scoping pattern established
-- in 0013_client_portal.sql for public.projects was never extended to
-- project_delays, daily_progress_reports, or dpr_checklist_items — all three
-- previously granted blanket SELECT to any authenticated user (including
-- client, and in project_delays' case even 'contractor'), letting a client
-- account read every project's delays and DPRs, not just their linked one.
--
-- Note: originally scoped as 0042_client_role_rls_hardening.sql per the task
-- that produced it, but 0042 was already taken by
-- 0042_users_update_admin_and_role_guard.sql — renumbered to the next free
-- slot after 0045_task_dependencies.sql.
--
-- The public.users phone/email exposure (gap #3) is handled in the query
-- layer instead — see lib/queries/profile.ts, which is the only call site
-- that ever renders another user's phone number, and is now viewer-aware
-- (self or admin/project_manager see the real values; everyone else gets a
-- "hidden" sentinel). RLS on public.users itself is intentionally left
-- permissive at the row level: ~25 existing query-layer joins across the app
-- (grievances, safety incidents, DPR, resource allocations, finance,
-- documents, punch list, signatures, tenders, leaves) embed
-- users(full_name, email) for internal staff attribution and depend on that
-- row being visible under RLS for their embed to resolve — Postgres RLS
-- cannot mask individual columns within a visible row, and column-level
-- GRANT/REVOKE can't be conditioned on the app's role column since every
-- signed-in user shares the single Postgres `authenticated` role. Tightening
-- row-level access would either break all of those embeds or require
-- rebuilding them behind a SECURITY DEFINER RPC — a separate, larger effort
-- than this pass. See users_public below for the safe subset going forward,
-- and lib/queries/client.ts's getClientDocuments, which had its own
-- client-facing uploader-email leak fixed alongside this migration.
-- =============================================================================

-- 1. project_delays: client sees only delays on their linked project(s);
--    admin/project_manager/site_staff keep unrestricted visibility as today.
DROP POLICY IF EXISTS "project_delays_select" ON public.project_delays;
CREATE POLICY "project_delays_select" ON public.project_delays
FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','project_manager','site_staff'))
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_delays.project_id AND p.client_id = auth.uid())
);

-- 2. daily_progress_reports: extend SELECT to client, scoped to their
--    project(s). INSERT/UPDATE/DELETE are untouched — client stays read-only.
DROP POLICY IF EXISTS "dpr_select" ON public.daily_progress_reports;
CREATE POLICY "dpr_select" ON public.daily_progress_reports
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','project_manager','site_staff'))
  OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = daily_progress_reports.project_id AND p.client_id = auth.uid())
);

-- 3. dpr_checklist_items: same audience as its parent DPR, resolved via the
--    parent's project_id. INSERT/UPDATE/DELETE are untouched.
DROP POLICY IF EXISTS "dpr_checklist_select" ON public.dpr_checklist_items;
CREATE POLICY "dpr_checklist_select" ON public.dpr_checklist_items
FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin','project_manager','site_staff'))
  OR EXISTS (
    SELECT 1 FROM public.daily_progress_reports d
    JOIN public.projects p ON p.id = d.project_id
    WHERE d.id = dpr_checklist_items.dpr_id AND p.client_id = auth.uid()
  )
);

-- 4. users_public: a safe projection (id, full_name, role, avatar_url — no
--    phone/email) for any lookup that only needs name/role/avatar. Defined
--    without security_invoker so it runs as its owner and bypasses RLS on the
--    base table, the standard "public view over an RLS table" pattern —
--    every authenticated user can resolve anyone's name/role/avatar through
--    this view regardless of the base table's own row policy. Supabase's
--    linter flags this as a "Security Definer View" advisory (ERROR level) —
--    that's the intended behavior here, not a leak: the view's column list
--    never includes phone or email, so there is nothing sensitive to bypass.
CREATE OR REPLACE VIEW public.users_public AS
SELECT id, full_name, role, avatar_url FROM public.users;

GRANT SELECT ON public.users_public TO authenticated;

NOTIFY pgrst, 'reload schema';
