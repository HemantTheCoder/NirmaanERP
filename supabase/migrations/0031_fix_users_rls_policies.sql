-- Fix RLS policies on public.users:
-- 1. users_insert_own in migration 0030 has a vacuous `OR true` check that
--    would let any anon-key holder insert an arbitrary row (e.g. role: 'admin').
--    The live database was never affected (its policy already reads correctly),
--    but the migration file itself must not carry the vulnerable version forward
--    for anyone bootstrapping a fresh environment from these files.
-- 2. users_select_all has no role restriction, making every user's profile
--    (email, full_name, role) readable by the public anon key.

DROP POLICY IF EXISTS "users_insert_own" ON public.users;
CREATE POLICY "users_insert_own" ON public.users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT
TO authenticated
USING (true);
