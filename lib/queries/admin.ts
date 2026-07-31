import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";

export interface AdminUserItem {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  taskCount: number;
  projectCount: number;
  organizedMeetingCount: number;
  invitedMeetingCount: number;
  notificationCount: number;
  attendanceCount: number;
  leaveCount: number;
}

export interface UserOrphanCheckResult {
  canDelete: boolean;
  reasons: string[];
  isLastAdmin: boolean;
}

/**
 * Fetch all users with associated activity counts across all 7 relational tables
 */
export async function getAllAdminUsers(
  supabase: SupabaseClient<Database>
): Promise<AdminUserItem[]> {
  const { data: usersData, error } = await (supabase.from("users") as any)
    .select("*")
    .order("created_at", { ascending: false });

  if (error || !usersData) {
    console.error("Error fetching users for admin:", error);
    return [];
  }

  // Parallel count queries across relational tables
  const [
    { data: tasks },
    { data: projects },
    { data: meetings },
    { data: attendees },
    { data: notifications },
    { data: attendance },
    { data: leaves },
  ] = await Promise.all([
    (supabase.from("tasks") as any).select("id, assignee_id"),
    (supabase.from("projects") as any).select("id, manager_id"),
    (supabase.from("meetings") as any).select("id, organizer_id"),
    (supabase.from("meeting_attendees") as any).select("meeting_id, user_id"),
    (supabase.from("notifications") as any).select("id, user_id"),
    (supabase.from("attendance") as any).select("id, user_id"),
    (supabase.from("leaves") as any).select("id, user_id"),
  ]);

  const taskList = tasks || [];
  const projectList = projects || [];
  const meetingList = meetings || [];
  const attendeeList = attendees || [];
  const notificationList = notifications || [];
  const attendanceList = attendance || [];
  const leaveList = leaves || [];

  return usersData.map((u: any) => ({
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role: u.role as UserRole,
    is_active: u.is_active ?? true,
    created_at: u.created_at,
    last_sign_in_at: null, // Populated via auth admin or activity session query
    taskCount: taskList.filter((t: any) => t.assignee_id === u.id).length,
    projectCount: projectList.filter((p: any) => p.manager_id === u.id).length,
    organizedMeetingCount: meetingList.filter((m: any) => m.organizer_id === u.id).length,
    invitedMeetingCount: attendeeList.filter((a: any) => a.user_id === u.id).length,
    notificationCount: notificationList.filter((n: any) => n.user_id === u.id).length,
    attendanceCount: attendanceList.filter((att: any) => att.user_id === u.id).length,
    leaveCount: leaveList.filter((l: any) => l.user_id === u.id).length,
  }));
}

/**
 * Count total active admin users in system
 */
export async function getActiveAdminCount(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { data } = await (supabase.from("users") as any)
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true);

  return (data || []).length;
}

/**
 * Change user role with Last Admin Guard
 */
export async function updateUserRole(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; error?: string }> {
  // Check target user's current role
  const { data: target } = await (supabase.from("users") as any)
    .select("role, is_active")
    .eq("id", targetUserId)
    .single();

  if (target?.role === "admin" && newRole !== "admin") {
    const adminCount = await getActiveAdminCount(supabase);
    if (adminCount <= 1) {
      return {
        success: false,
        error: "Permission denied: Cannot demote the last remaining active admin account.",
      };
    }
  }

  const { error } = await (supabase.from("users") as any)
    .update({ role: newRole })
    .eq("id", targetUserId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Toggle user active status with Last Admin Guard
 */
export async function toggleUserActive(
  supabase: SupabaseClient<Database>,
  targetUserId: string,
  isActive: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isActive) {
    const { data: target } = await (supabase.from("users") as any)
      .select("role")
      .eq("id", targetUserId)
      .single();

    if (target?.role === "admin") {
      const adminCount = await getActiveAdminCount(supabase);
      if (adminCount <= 1) {
        return {
          success: false,
          error: "Permission denied: Cannot deactivate the last remaining active admin account.",
        };
      }
    }
  }

  const { error } = await (supabase.from("users") as any)
    .update({ is_active: isActive })
    .eq("id", targetUserId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Check if a user has orphan references across all 7 relational tables
 */
export async function checkUserOrphanStatus(
  supabase: SupabaseClient<Database>,
  targetUserId: string
): Promise<UserOrphanCheckResult> {
  const { data: target } = await (supabase.from("users") as any)
    .select("role")
    .eq("id", targetUserId)
    .single();

  const isLastAdmin =
    target?.role === "admin" && (await getActiveAdminCount(supabase)) <= 1;

  const reasons: string[] = [];

  if (isLastAdmin) {
    reasons.push("Cannot delete the last remaining active admin account.");
  }

  const [
    { count: taskCount },
    { count: projectCount },
    { count: organizedMeetingCount },
    { count: invitedMeetingCount },
    { count: notificationCount },
    { count: attendanceCount },
    { count: leaveCount },
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", targetUserId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("manager_id", targetUserId),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("organizer_id", targetUserId),
    supabase.from("meeting_attendees").select("meeting_id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("leaves").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
  ]);

  if ((taskCount ?? 0) > 0) reasons.push(`Assigned to ${taskCount} task(s)`);
  if ((projectCount ?? 0) > 0) reasons.push(`Manager of ${projectCount} project(s)`);
  if ((organizedMeetingCount ?? 0) > 0) reasons.push(`Organizer of ${organizedMeetingCount} meeting(s)`);
  if ((invitedMeetingCount ?? 0) > 0) reasons.push(`Invited attendee in ${invitedMeetingCount} meeting(s)`);
  if ((notificationCount ?? 0) > 0) reasons.push(`Has ${notificationCount} notification record(s)`);
  if ((attendanceCount ?? 0) > 0) reasons.push(`Has ${attendanceCount} attendance record(s)`);
  if ((leaveCount ?? 0) > 0) reasons.push(`Has ${leaveCount} leave request record(s)`);

  return {
    canDelete: reasons.length === 0,
    reasons,
    isLastAdmin,
  };
}
