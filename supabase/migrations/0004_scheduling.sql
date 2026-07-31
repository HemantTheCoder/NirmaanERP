-- =============================================================================
-- Nirmaan ERP — Scheduling (Migration 0004)
-- Tables: meetings, meeting_attendees, meeting_minutes, notifications
-- Also: BEFORE UPDATE trigger on tasks to prevent unauthorized assignee changes
-- =============================================================================

-- ── New Enums ─────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE location_type AS ENUM ('on_site', 'virtual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE meeting_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE rsvp_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'task_assigned',
    'meeting_invite',
    'status_change',
    'approval_needed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Meetings ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meetings (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT            NOT NULL,
  project_id      UUID            REFERENCES public.projects(id) ON DELETE SET NULL,
  organizer_id    UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  start_time      TIMESTAMPTZ     NOT NULL,
  end_time        TIMESTAMPTZ     NOT NULL,
  location_type   location_type   NOT NULL DEFAULT 'virtual',
  location_detail TEXT,
  status          meeting_status  NOT NULL DEFAULT 'scheduled',
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);

COMMENT ON TABLE public.meetings IS 'Project and team meetings with location and scheduling details';

-- ── Meeting Attendees (join table) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.meeting_attendees (
  meeting_id  UUID        NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rsvp_status rsvp_status NOT NULL DEFAULT 'pending',
  PRIMARY KEY (meeting_id, user_id)
);

COMMENT ON TABLE public.meeting_attendees IS 'Many-to-many: meeting participants and their RSVP status';

-- ── Meeting Minutes ───────────────────────────────────────────────────────────
-- One record per meeting (UNIQUE on meeting_id); upsert-friendly.

CREATE TABLE IF NOT EXISTS public.meeting_minutes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id  UUID        NOT NULL UNIQUE REFERENCES public.meetings(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL DEFAULT '',
  created_by  UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.meeting_minutes IS 'Text-only meeting notes; one record per meeting (upsertable)';

-- ── Notifications ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID                NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        notification_type   NOT NULL,
  message     TEXT                NOT NULL,
  link        TEXT                NOT NULL DEFAULT '/dashboard',
  read        BOOLEAN             NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notifications IS 'In-app notifications for task assignments, meeting invites, and status changes';

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_meetings_organizer_id     ON public.meetings(organizer_id);
CREATE INDEX IF NOT EXISTS idx_meetings_start_time       ON public.meetings(start_time);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON public.meeting_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id     ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read   ON public.notifications(user_id, read);

-- ── Row-Level Security ────────────────────────────────────────────────────────

ALTER TABLE public.meetings          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications     ENABLE ROW LEVEL SECURITY;

-- meetings: visible if organizer or invited attendee
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;
DROP POLICY IF EXISTS "meetings_insert" ON public.meetings;
DROP POLICY IF EXISTS "meetings_update" ON public.meetings;
DROP POLICY IF EXISTS "meetings_delete" ON public.meetings;

CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (
  organizer_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meeting_attendees
    WHERE meeting_id = id AND user_id = auth.uid()
  )
);
CREATE POLICY "meetings_insert" ON public.meetings FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);
CREATE POLICY "meetings_update" ON public.meetings FOR UPDATE USING (
  organizer_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
  )
);
CREATE POLICY "meetings_delete" ON public.meetings FOR DELETE USING (
  organizer_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
  )
);

-- meeting_attendees: attendee sees own rows; organizer sees all rows for their meeting
DROP POLICY IF EXISTS "attendees_select" ON public.meeting_attendees;
DROP POLICY IF EXISTS "attendees_insert" ON public.meeting_attendees;
DROP POLICY IF EXISTS "attendees_update" ON public.meeting_attendees;
DROP POLICY IF EXISTS "attendees_delete" ON public.meeting_attendees;

CREATE POLICY "attendees_select" ON public.meeting_attendees FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.meetings
    WHERE id = meeting_id AND organizer_id = auth.uid()
  )
);
CREATE POLICY "attendees_insert" ON public.meeting_attendees FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings
    WHERE id = meeting_id AND organizer_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
  )
);
CREATE POLICY "attendees_update" ON public.meeting_attendees FOR UPDATE USING (
  user_id = auth.uid()
);
CREATE POLICY "attendees_delete" ON public.meeting_attendees FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.meetings
    WHERE id = meeting_id AND organizer_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
  )
);

-- meeting_minutes: all meeting members can SELECT; only organizer/admin can INSERT/UPDATE
DROP POLICY IF EXISTS "minutes_select" ON public.meeting_minutes;
DROP POLICY IF EXISTS "minutes_insert" ON public.meeting_minutes;
DROP POLICY IF EXISTS "minutes_update" ON public.meeting_minutes;

CREATE POLICY "minutes_select" ON public.meeting_minutes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND (
      m.organizer_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.meeting_attendees
        WHERE meeting_id = m.id AND user_id = auth.uid()
      )
    )
  )
);
CREATE POLICY "minutes_insert" ON public.meeting_minutes FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND m.organizer_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "minutes_update" ON public.meeting_minutes FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.meetings m
    WHERE m.id = meeting_id AND m.organizer_id = auth.uid()
  ) OR
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- notifications: each user sees and updates only their own
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT USING (
  user_id = auth.uid()
);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE USING (
  user_id = auth.uid()
);
-- INSERT is performed by SECURITY DEFINER trigger functions (not by the client directly)
CREATE POLICY "notifications_insert" ON public.notifications FOR INSERT WITH CHECK (
  user_id = auth.uid()
);

-- ── Task Reassignment Guard ───────────────────────────────────────────────────
-- BEFORE UPDATE trigger: reject assignee_id changes from non-admin/PM callers.
-- WITH CHECK alone cannot compare old vs new column values, so a trigger is used.

CREATE OR REPLACE FUNCTION public.prevent_task_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'project_manager')
    ) THEN
      RAISE EXCEPTION
        'permission denied: only admins and project managers can reassign tasks';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_task_reassignment ON public.tasks;
CREATE TRIGGER trg_prevent_task_reassignment
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.prevent_task_reassignment();

-- ── Auto-Notification: Task Assigned ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only fire when assignee_id is set and has changed (or is new)
  IF NEW.assignee_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR
    NEW.assignee_id IS DISTINCT FROM OLD.assignee_id
  ) THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.assignee_id,
      'task_assigned',
      'You have been assigned a task: ' || NEW.title,
      '/workspace'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.tasks;
CREATE TRIGGER trg_notify_task_assigned
  AFTER INSERT OR UPDATE OF assignee_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

-- ── Auto-Notification: Meeting Invite ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_meeting_invite()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, message, link)
  SELECT
    NEW.user_id,
    'meeting_invite'::notification_type,
    'You have been invited to: ' || COALESCE(m.title, 'a meeting'),
    '/schedule'
  FROM public.meetings m
  WHERE m.id = NEW.meeting_id
    AND NEW.user_id IS DISTINCT FROM m.organizer_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_meeting_invite ON public.meeting_attendees;
CREATE TRIGGER trg_notify_meeting_invite
  AFTER INSERT ON public.meeting_attendees
  FOR EACH ROW EXECUTE FUNCTION public.notify_meeting_invite();

-- ── Auto-Notification: Project Status Changed ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.notify_project_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.manager_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, message, link)
    VALUES (
      NEW.manager_id,
      'status_change',
      'Project "' || NEW.name || '" status changed to ' || NEW.status::TEXT,
      '/projects/' || NEW.id::TEXT
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_project_status_change ON public.projects;
CREATE TRIGGER trg_notify_project_status_change
  AFTER UPDATE OF status ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_status_change();
