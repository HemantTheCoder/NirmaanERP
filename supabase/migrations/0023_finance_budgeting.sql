-- =============================================================================
-- Nirmaan ERP — Migration 0023: Finance & Budgeting (Lightweight)
-- =============================================================================

-- 1. Extend public.projects table with budget_allocated
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS budget_allocated NUMERIC DEFAULT NULL;

-- 2. Add expense_status_change to notification_type ENUM FIRST
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'expense_status_change';

-- 3. Create ENUM types for expenses
DO $$ BEGIN
  CREATE TYPE public.expense_category AS ENUM (
    'labor',
    'materials',
    'equipment_rental',
    'subcontractor',
    'other'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.expense_status AS ENUM (
    'pending',
    'approved',
    'rejected'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 4. Create public.expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category public.expense_category NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  logged_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.expense_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  rejection_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ DEFAULT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_expenses_project_id ON public.expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_expenses_logged_by ON public.expenses(logged_by);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON public.expenses(status);

-- 5. Row Level Security Policies on public.expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expenses_select" ON public.expenses;
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;

-- SELECT Policy:
-- Admin & Project Manager: view all project expenses
-- Site Staff: view only their own logged expenses (logged_by = auth.uid())
-- Client & Contractor: no access (0 rows)
CREATE POLICY "expenses_select" ON public.expenses
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
  OR (
    logged_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.users
       WHERE id = auth.uid()
         AND role = 'site_staff'
    )
  )
);

-- INSERT Policy:
-- Admin, Project Manager, Site Staff can insert as themselves with status 'pending'
CREATE POLICY "expenses_insert" ON public.expenses
FOR INSERT WITH CHECK (
  logged_by = auth.uid()
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager', 'site_staff')
  )
);

-- UPDATE Policy:
-- Restricted entirely to Admin & Project Manager (whole-row security)
CREATE POLICY "expenses_update" ON public.expenses
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- DELETE Policy:
-- Admin only
CREATE POLICY "expenses_delete" ON public.expenses
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role = 'admin'
  )
);

-- 6. Notification Trigger on Expense Approval/Rejection Status Change
CREATE OR REPLACE FUNCTION notify_expense_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  status_label TEXT;
BEGIN
  IF NEW.status = 'approved' THEN
    status_label := 'approved';
  ELSIF NEW.status = 'rejected' THEN
    status_label := 'rejected';
  ELSE
    RETURN NEW;
  END IF;

  -- Notify the user who logged the expense
  INSERT INTO public.notifications (
    user_id,
    type,
    message,
    link
  ) VALUES (
    NEW.logged_by,
    'expense_status_change'::public.notification_type,
    'Your expense request (₹' || TRIM(TO_CHAR(NEW.amount, '99,99,99,999')) || ' for ' || SUBSTRING(NEW.description FROM 1 FOR 30) || ') has been ' || status_label || '.',
    '/projects/' || NEW.project_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_expense_status_change ON public.expenses;
CREATE TRIGGER trg_notify_expense_status_change
AFTER UPDATE OF status ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION notify_expense_status_change();

-- 7. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
