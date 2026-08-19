-- =============================================================================
-- Nirmaan ERP — Migration 0040: Direct Messaging (1:1)
-- =============================================================================
-- notification_type already has 'new_message' (added in 0037, ahead of this
-- table, since ALTER TYPE ADD VALUE must be isolated from other DDL).

-- 1. Table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) > 0),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.messages IS '1:1 direct messages between users. No group chat.';

-- 2. Index for thread lookups (either direction of a pair, newest first)
CREATE INDEX IF NOT EXISTS idx_messages_recipient_sender_created
  ON public.messages(recipient_id, sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_recipient_created
  ON public.messages(sender_id, recipient_id, created_at);

-- 3. Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;

CREATE POLICY "messages_select" ON public.messages FOR SELECT TO authenticated USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

CREATE POLICY "messages_insert" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
);

-- Only the recipient can update a message. The RLS predicate alone can't
-- restrict *which* columns change on an UPDATE — a WITH CHECK comparing a
-- column to itself is always true regardless of the new value, so it's not
-- real protection. The BEFORE UPDATE trigger below does the actual
-- column-lock (same pattern as trg_guard_client_project_update in 0013),
-- limiting recipients to flipping `read` only.
CREATE POLICY "messages_update" ON public.messages FOR UPDATE TO authenticated
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);

CREATE OR REPLACE FUNCTION public.trg_guard_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF OLD.id IS DISTINCT FROM NEW.id OR
     OLD.sender_id IS DISTINCT FROM NEW.sender_id OR
     OLD.recipient_id IS DISTINCT FROM NEW.recipient_id OR
     OLD.body IS DISTINCT FROM NEW.body OR
     OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Only the read flag can be updated on a message.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_message_update_guard ON public.messages;
CREATE TRIGGER trg_message_update_guard
BEFORE UPDATE ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.trg_guard_message_update();

-- 4. Notify the recipient on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  sender_name TEXT;
BEGIN
  SELECT COALESCE(full_name, email) INTO sender_name FROM public.users WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, type, message, link)
  VALUES (
    NEW.recipient_id,
    'new_message'::notification_type,
    'New message from ' || COALESCE(sender_name, 'a user') || ': '
      || CASE WHEN char_length(NEW.body) > 80 THEN left(NEW.body, 77) || '...' ELSE NEW.body END,
    '/profile/' || NEW.sender_id::TEXT
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_new_message();

-- 5. Enable Realtime on this table (postgres_changes subscriptions require the
-- table to be part of the supabase_realtime publication; it isn't by default).
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
