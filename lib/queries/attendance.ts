import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface AttendanceItem {
  id: string;
  user_id: string;
  date: string;
  check_in: string | null;
  check_out: string | null;
  status: "present" | "absent" | "half_day" | "on_leave" | "late";
  check_in_latitude?: number | null;
  check_in_longitude?: number | null;
  check_in_within_geofence?: boolean | null;
  check_in_distance_meters?: number | null;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string;
  } | null;
}

function getTodayString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Fetch today's attendance record for the user
 */
export async function getTodayAttendance(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<AttendanceItem | null> {
  const todayStr = getTodayString();

  const { data, error } = await (supabase.from("attendance") as any)
    .select("*")
    .eq("user_id", userId)
    .eq("date", todayStr)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as AttendanceItem;
}

/**
 * Fetch attendance history for the user (last 30 days)
 */
export async function getMyAttendance(
  supabase: SupabaseClient<Database>,
  userId: string,
  limitDays = 30
): Promise<AttendanceItem[]> {
  const { data, error } = await (supabase.from("attendance") as any)
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limitDays);

  if (error || !data) {
    console.error("Error fetching attendance history:", error);
    return [];
  }

  return data as AttendanceItem[];
}

/**
 * Record check-in timestamp for today with optional geofence audit data.
 */
export async function checkIn(
  supabase: SupabaseClient<Database>,
  userId: string,
  geofenceData?: {
    latitude?: number | null;
    longitude?: number | null;
    withinGeofence?: boolean | null;
    distanceMeters?: number | null;
  }
): Promise<{ success: boolean; attendance?: AttendanceItem; error?: string }> {
  const todayStr = getTodayString();

  // 1. Check if user already checked in today
  const existing = await getTodayAttendance(supabase, userId);
  if (existing) {
    return { success: false, error: "You have already checked in for today." };
  }

  // 2. Insert check-in record
  const nowIso = new Date().toISOString();
  const insertPayload: any = {
    user_id: userId,
    date: todayStr,
    check_in: nowIso,
  };

  if (geofenceData) {
    if (geofenceData.latitude !== undefined) insertPayload.check_in_latitude = geofenceData.latitude;
    if (geofenceData.longitude !== undefined) insertPayload.check_in_longitude = geofenceData.longitude;
    if (geofenceData.withinGeofence !== undefined) insertPayload.check_in_within_geofence = geofenceData.withinGeofence;
    if (geofenceData.distanceMeters !== undefined) insertPayload.check_in_distance_meters = geofenceData.distanceMeters;
  }

  const { data, error } = await (supabase.from("attendance") as any)
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Check-in failed" };
  }

  return { success: true, attendance: data as AttendanceItem };
}

/**
 * Record check-out timestamp for today.
 */
export async function checkOut(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<{ success: boolean; attendance?: AttendanceItem; error?: string }> {
  const todayRecord = await getTodayAttendance(supabase, userId);
  if (!todayRecord) {
    return { success: false, error: "No check-in record found for today. Please check in first." };
  }

  if (todayRecord.check_out) {
    return { success: false, error: "You have already checked out for today." };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await (supabase.from("attendance") as any)
    .update({ check_out: nowIso })
    .eq("id", todayRecord.id)
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Check-out failed" };
  }

  return { success: true, attendance: data as AttendanceItem };
}
