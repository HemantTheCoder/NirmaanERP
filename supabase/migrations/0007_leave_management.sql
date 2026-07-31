-- =============================================================================
-- Nirmaan ERP — Migration 0007: Leave Management & Notification Triggers
-- Adds rejection_reason column, hardens RLS policies, and creates auto-notification trigger.
-- =============================================================================

-- 1. Add rejection_reason column
ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

COMMENT ON COLUMN public.leaves.rejection_reason IS 'Reason provided by admin or project manager when rejecting a leave request.';

-- 2. Harden RLS policies for leaves table
DROP POLICY IF EXISTS "leaves_select" ON public.leaves;
DROP POLICY IF EXISTS "leaves_insert" ON public.leaves;
DROP POLICY IF EXISTS "leaves_update" ON public.leaves;
DROP POLICY IF EXISTS "leaves_delete" ON public.leaves;

-- Authenticated users can view their own leave requests; admin & project manager can view all
CREATE POLICY "leaves_select" ON public.leaves FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- Users can submit leave requests for themselves
CREATE POLICY "leaves_insert" ON public.leaves FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- Admin and project manager can update status, approved_by, and rejection_reason on any leave request
CREATE POLICY "leaves_update" ON public.leaves FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- Admin can delete leave requests if needed
CREATE POLICY "leaves_delete" ON public.leaves FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 3. Automatic Notification Trigger on Leave Status Changes
CREATE OR REPLACE FUNCTION notify_leave_status_change()
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

  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    link
  ) VALUES (
    NEW.user_id,
    'Leave Request ' || INITCAP(status_label),
    'Your leave request (' || NEW.start_date || ' to ' || NEW.end_date || ') has been ' || status_label || '.',
    'status_change',
    '/workspace'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_leave_status_change ON public.leaves;

CREATE TRIGGER trg_notify_leave_status_change
  AFTER UPDATE OF status ON public.leaves
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION notify_leave_status_change();
