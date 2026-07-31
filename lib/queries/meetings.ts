import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { LocationType, MeetingStatus, RsvpStatus } from "@/types/database";

export type { LocationType, MeetingStatus, RsvpStatus };

// ── Shared types ──────────────────────────────────────────────────────────────

export interface MeetingForCalendar {
  id: string;
  title: string;
  start_time: string; // ISO string (UTC)
  end_time: string;   // ISO string (UTC)
  location_type: LocationType;
  location_detail: string | null;
  status: MeetingStatus;
  project_id: string | null;
  project_name: string | null;
  organizer_id: string;
  organizer_name: string | null;
}

export interface AttendeeWithUser {
  rsvp_status: RsvpStatus;
  user: {
    id: string;
    full_name: string | null;
    email: string;
  } | null;
}

export interface MeetingMinutesData {
  id: string;
  content: string;
  created_at: string;
}

export interface MeetingWithDetails extends MeetingForCalendar {
  attendees: AttendeeWithUser[];
  minutes: MeetingMinutesData | null;
}

export interface UpcomingMeetingItem {
  id: string;
  title: string;
  start_time: string;
  end_time: string;
  location_type: LocationType;
  organizer_name: string | null;
  attendee_initials: string[];
  attendee_count: number;
}

// ── Query functions ───────────────────────────────────────────────────────────

/**
 * Fetch all meetings accessible to the current user (RLS-filtered):
 * meetings they organized or are invited to.
 */
export async function getMeetings(
  supabase: SupabaseClient<Database>
): Promise<MeetingForCalendar[]> {
  const { data, error } = await (supabase.from("meetings") as any)
    .select(`
      id, title, start_time, end_time, location_type, location_detail,
      status, project_id, organizer_id,
      users!organizer_id(full_name),
      projects(name)
    `)
    .order("start_time", { ascending: true });

  if (error) {
    console.error("Error fetching meetings:", error);
    return [];
  }

  return (data || []).map((m: any) => ({
    id: m.id,
    title: m.title,
    start_time: m.start_time,
    end_time: m.end_time,
    location_type: m.location_type as LocationType,
    location_detail: m.location_detail,
    status: m.status as MeetingStatus,
    project_id: m.project_id,
    project_name: m.projects?.name ?? null,
    organizer_id: m.organizer_id,
    organizer_name: m.users?.full_name ?? null,
  }));
}

/**
 * Fetch a single meeting with full attendee list and minutes.
 */
export async function getMeetingById(
  supabase: SupabaseClient<Database>,
  id: string
): Promise<MeetingWithDetails | null> {
  const { data, error } = await (supabase.from("meetings") as any)
    .select(`
      id, title, start_time, end_time, location_type, location_detail,
      status, project_id, organizer_id,
      users!organizer_id(full_name),
      projects(name),
      meeting_attendees(
        rsvp_status,
        users(id, full_name, email)
      ),
      meeting_minutes(id, content, created_at)
    `)
    .eq("id", id)
    .single();

  if (error || !data) {
    console.error("Error fetching meeting detail:", error);
    return null;
  }

  const minutesArr: any[] = Array.isArray(data.meeting_minutes)
    ? data.meeting_minutes
    : data.meeting_minutes
    ? [data.meeting_minutes]
    : [];

  return {
    id: data.id,
    title: data.title,
    start_time: data.start_time,
    end_time: data.end_time,
    location_type: data.location_type as LocationType,
    location_detail: data.location_detail,
    status: data.status as MeetingStatus,
    project_id: data.project_id,
    project_name: data.projects?.name ?? null,
    organizer_id: data.organizer_id,
    organizer_name: data.users?.full_name ?? null,
    attendees: (data.meeting_attendees || []).map((a: any) => ({
      rsvp_status: a.rsvp_status as RsvpStatus,
      user: a.users
        ? { id: a.users.id, full_name: a.users.full_name, email: a.users.email }
        : null,
    })),
    minutes: minutesArr.length > 0
      ? { id: minutesArr[0].id, content: minutesArr[0].content, created_at: minutesArr[0].created_at }
      : null,
  };
}

/**
 * Create a meeting and optionally add attendees in one operation.
 * Attendee insert triggers auto-notifications via DB trigger.
 */
export async function createMeetingWithAttendees(
  supabase: SupabaseClient<Database>,
  payload: {
    title: string;
    project_id?: string;
    organizer_id: string;
    start_time: string;
    end_time: string;
    location_type: LocationType;
    location_detail?: string;
  },
  attendeeIds: string[]
): Promise<{ data: MeetingForCalendar | null; error: any }> {
  const { data: meeting, error } = await (supabase.from("meetings") as any)
    .insert({
      title: payload.title,
      project_id: payload.project_id || null,
      organizer_id: payload.organizer_id,
      start_time: payload.start_time,
      end_time: payload.end_time,
      location_type: payload.location_type,
      location_detail: payload.location_detail || null,
    })
    .select("id, title, start_time, end_time, location_type, location_detail, status, project_id, organizer_id")
    .single();

  if (error || !meeting) {
    return { data: null, error };
  }

  if (attendeeIds.length > 0) {
    const rows = attendeeIds.map((user_id) => ({
      meeting_id: meeting.id,
      user_id,
      rsvp_status: "pending" as RsvpStatus,
    }));
    const { error: attendeeErr } = await (supabase.from("meeting_attendees") as any)
      .insert(rows);
    if (attendeeErr) {
      console.error("Error adding meeting attendees:", attendeeErr);
    }
  }

  return {
    data: {
      id: meeting.id,
      title: meeting.title,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      location_type: meeting.location_type as LocationType,
      location_detail: meeting.location_detail,
      status: meeting.status as MeetingStatus,
      project_id: meeting.project_id,
      project_name: meeting.projects?.name ?? null,
      organizer_id: meeting.organizer_id,
      organizer_name: meeting.users?.full_name ?? null,
    },
    error: null,
  };
}

/**
 * Update the RSVP status for the current user on a given meeting.
 */
export async function updateRsvpStatus(
  supabase: SupabaseClient<Database>,
  meetingId: string,
  userId: string,
  status: RsvpStatus
) {
  return (supabase.from("meeting_attendees") as any)
    .update({ rsvp_status: status })
    .eq("meeting_id", meetingId)
    .eq("user_id", userId);
}

/**
 * Upsert meeting minutes (text-only). One record per meeting (UNIQUE constraint).
 */
export async function saveMeetingMinutes(
  supabase: SupabaseClient<Database>,
  meetingId: string,
  content: string,
  createdBy: string
) {
  return (supabase.from("meeting_minutes") as any).upsert(
    { meeting_id: meetingId, content, created_by: createdBy },
    { onConflict: "meeting_id" }
  );
}

/**
 * Fetch the next N upcoming meetings for the current user (RLS-filtered).
 * Used by the dashboard widget.
 */
export async function getUpcomingMeetings(
  supabase: SupabaseClient<Database>,
  limit: number = 3
): Promise<UpcomingMeetingItem[]> {
  const now = new Date().toISOString();

  const { data, error } = await (supabase.from("meetings") as any)
    .select(`
      id, title, start_time, end_time, location_type,
      users!organizer_id(full_name),
      meeting_attendees(user_id, users(full_name))
    `)
    .gte("start_time", now)
    .eq("status", "scheduled")
    .order("start_time", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Error fetching upcoming meetings:", error);
    return [];
  }

  return (data || []).map((m: any) => {
    const attendees: any[] = m.meeting_attendees || [];
    return {
      id: m.id,
      title: m.title,
      start_time: m.start_time,
      end_time: m.end_time,
      location_type: m.location_type as LocationType,
      organizer_name: m.users?.full_name ?? null,
      attendee_initials: attendees.slice(0, 4).map((a: any) => {
        const name: string = a.users?.full_name ?? "?";
        return name
          .split(" ")
          .map((n) => n[0] ?? "")
          .slice(0, 2)
          .join("")
          .toUpperCase();
      }),
      attendee_count: attendees.length,
    };
  });
}
