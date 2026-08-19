-- Two related fixes to public.users' UPDATE surface:
--
-- 1. users_update_own only ever allowed `id = auth.uid()` — an admin trying
--    to change a DIFFERENT user's role or is_active (via lib/queries/admin.ts
--    updateUserRole()/toggleUserActive(), used by the admin panel) is
--    silently blocked by RLS. Supabase's .update() reports no error on a
--    zero-row update, so the admin UI shows the change as if it worked while
--    the database never changed. Restore the "own row OR admin" clause on
--    both USING and WITH CHECK (the migration 0030 file already intended
--    this, but the live policy had drifted to the simpler own-row-only
--    version).
--
-- 2. With that broadened, a non-admin user could update every column on
--    their own row — including role, to 'admin' — since RLS is row-level and
--    a WITH CHECK matching the USING clause doesn't restrict which VALUES a
--    specific column may take. A BEFORE UPDATE trigger is the actual guard:
--    admins may change any role; a brand-new account may set its own role
--    once within a few minutes of signup (the Google OAuth handoff in
--    app/auth/callback/route.ts — OAuth has no equivalent of signUp()'s
--    options.data, so the role chosen on the signup form travels via a
--    follow-up self-UPDATE instead); any other role change on your own row
--    is rejected.

-- 0. The `authenticated` role is missing the UPDATE grant on this table
--    entirely (every other table in this schema grants it by Supabase's
--    default) — no RLS policy can matter until the underlying privilege
--    exists. Without this, every authenticated update attempt fails at the
--    grant level with 42501 before RLS is even consulted.
GRANT UPDATE ON public.users TO authenticated;

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  auth.uid() = id
  OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin') THEN
      RETURN NEW;
    END IF;

    IF auth.uid() = NEW.id AND now() - OLD.created_at < interval '5 minutes' THEN
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Only an admin can change a user''s role after signup';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.users;
CREATE TRIGGER trg_prevent_self_role_escalation
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_escalation();

NOTIFY pgrst, 'reload schema';
