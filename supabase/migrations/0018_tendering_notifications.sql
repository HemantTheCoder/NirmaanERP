-- =============================================================================
-- Nirmaan ERP — Migration 0018: Tendering Triggers & Automatic Notifications
-- Creates notify_bid_status_change() and notify_tender_published() triggers
-- to keep contractors updated on bid statuses and new published tenders.
-- =============================================================================

-- 1. Trigger Function: notify_bid_status_change()
CREATE OR REPLACE FUNCTION notify_bid_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  t_title TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT title INTO t_title FROM public.tenders WHERE id = NEW.tender_id;

    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.contractor_id,
      'status_change'::public.notification_type,
      'Your bid on tender "' || COALESCE(t_title, 'Tender') || '" status updated to: ' || UPPER(NEW.status::text),
      '/tenders/' || NEW.tender_id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_bid_status_change ON public.bids;
CREATE TRIGGER trg_notify_bid_status_change
AFTER UPDATE ON public.bids
FOR EACH ROW
EXECUTE FUNCTION notify_bid_status_change();


-- 2. Trigger Function: notify_tender_published()
CREATE OR REPLACE FUNCTION notify_tender_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    SELECT
      u.id,
      'status_change'::public.notification_type,
      'New Tender Published: "' || NEW.title || '" (Category: ' || UPPER(NEW.category) || ')',
      '/tenders/' || NEW.id
    FROM public.users u
    WHERE u.role = 'contractor' AND u.is_active = true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_tender_published ON public.tenders;
CREATE TRIGGER trg_notify_tender_published
AFTER INSERT OR UPDATE ON public.tenders
FOR EACH ROW
EXECUTE FUNCTION notify_tender_published();
