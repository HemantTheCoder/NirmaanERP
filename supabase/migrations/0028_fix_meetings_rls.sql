-- =============================================================================
-- Nirmaan ERP — Migration 0028: Fix Meetings RLS for Admin & PM Visibility
-- =============================================================================

-- Update meetings_select policy to allow Admin & Project Managers full visibility across projects
DROP POLICY IF EXISTS "meetings_select" ON public.meetings;

CREATE POLICY "meetings_select" ON public.meetings FOR SELECT USING (
  organizer_id = auth.uid()
  OR public.is_meeting_attendee(id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- Update attendees_select policy to allow Admin & PM visibility
DROP POLICY IF EXISTS "attendees_select" ON public.meeting_attendees;

CREATE POLICY "attendees_select" ON public.meeting_attendees FOR SELECT USING (
  user_id = auth.uid()
  OR public.is_meeting_organizer(meeting_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- Update minutes_select policy to allow Admin & PM visibility
DROP POLICY IF EXISTS "minutes_select" ON public.meeting_minutes;

CREATE POLICY "minutes_select" ON public.meeting_minutes FOR SELECT USING (
  public.is_meeting_organizer(meeting_id, auth.uid())
  OR public.is_meeting_attendee(meeting_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
