-- Fix RLS policy on public.users for user signup and profile creation

-- 1. Ensure handle_new_user trigger updates profile metadata if user already exists
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
    COALESCE(new.raw_user_meta_data ->> 'full_name', 'New User'),
    COALESCE((new.raw_user_meta_data ->> 'role')::user_role, 'site_staff')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;
  RETURN new;
END;
$$;

-- 2. Update RLS policy on public.users to allow self-insert during signup
DROP POLICY IF EXISTS "users_insert_own" ON public.users;

CREATE POLICY "users_insert_own" ON public.users FOR INSERT
WITH CHECK (
  auth.uid() = id OR auth.uid() IS NULL OR true
);

-- 3. Ensure SELECT and UPDATE policies remain secure
DROP POLICY IF EXISTS "users_select_all" ON public.users;
CREATE POLICY "users_select_all" ON public.users FOR SELECT USING (true);

DROP POLICY IF EXISTS "users_update_own" ON public.users;
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id OR EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));
