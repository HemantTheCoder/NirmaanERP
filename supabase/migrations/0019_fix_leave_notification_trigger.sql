-- =============================================================================
-- Nirmaan ERP — Migration 0019: Fix notify_leave_status() trigger
-- Removes non-existent 'title' column from notify_leave_status() notification insert.
-- =============================================================================

CREATE OR REPLACE FUNCTION notify_leave_status()
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
    type,
    message,
    link
  ) VALUES (
    NEW.user_id,
    'status_change'::public.notification_type,
    'Your leave request (' || NEW.start_date || ' to ' || NEW.end_date || ') has been ' || status_label || '.',
    '/workspace'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_leave_status_change ON public.leaves;
CREATE TRIGGER trg_notify_leave_status_change
AFTER UPDATE ON public.leaves
FOR EACH ROW
EXECUTE FUNCTION notify_leave_status();
