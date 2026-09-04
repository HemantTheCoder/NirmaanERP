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

  const { data, error } = await (supabase.from("users") as any)
    .update({ role: newRole })
    .eq("id", targetUserId)
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  // A blocked-by-RLS update reports no error and zero rows, not a failure —
  // check explicitly so a policy gap surfaces as an error instead of the UI
  // optimistically showing a change that never reached the database.
  if (!data || data.length === 0) {
    return { success: false, error: "Update was not applied (permission denied)." };
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

  const { data, error } = await (supabase.from("users") as any)
    .update({ is_active: isActive })
    .eq("id", targetUserId)
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  if (!data || data.length === 0) {
    return { success: false, error: "Update was not applied (permission denied)." };
  }

  return { success: true };
}

/**
 * Check if a user has orphan references across every relational table with
 * a foreign key to users(id) — 29 tables as of this writing. Many of these
 * (daily_progress_reports.submitted_by, messages.sender_id/recipient_id,
 * expenses.logged_by, punch_items.created_by, etc.) are ON DELETE CASCADE:
 * missing one here doesn't just leave a dangling reference, it means the
 * delete silently wipes that user's real business records with no warning.
 * This list needs to grow every time a migration adds a new users(id) FK.
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
    { count: projectManagerCount },
    { count: projectClientCount },
    { count: organizedMeetingCount },
    { count: invitedMeetingCount },
    { count: notificationCount },
    { count: attendanceCount },
    { count: leaveUserCount },
    { count: leaveApproverCount },
    { count: resourceRequesterCount },
    { count: resourceApproverCount },
    { count: docCount },
    { count: safetyReporterCount },
    { count: safetyAssigneeCount },
    { count: grievanceSubmitterCount },
    { count: grievanceAssigneeCount },
    { count: dprSubmitterCount },
    { count: delayReporterCount },
    { count: delayRectifierCount },
    { count: signatureCount },
    { count: poCreatorCount },
    { count: poApproverCount },
    { count: subcontractCreatorCount },
    { count: perfReviewerCount },
    { count: inventoryItemCreatorCount },
    { count: inventoryTxnCount },
    { count: equipmentCreatorCount },
    { count: equipmentLogCount },
    { count: rfiRaiserCount },
    { count: rfiAssigneeCount },
    { count: changeOrderRequesterCount },
    { count: changeOrderApproverCount },
    { count: tenderCreatorCount },
    { count: bidContractorCount },
    { count: bidReviewerCount },
    { count: messageSenderCount },
    { count: messageRecipientCount },
    { count: punchCreatorCount },
    { count: punchAssigneeCount },
    { count: expenseLoggerCount },
    { count: expenseApproverCount },
    { count: taskDependencyCreatorCount },
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("assignee_id", targetUserId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("manager_id", targetUserId),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", targetUserId),
    supabase.from("meetings").select("id", { count: "exact", head: true }).eq("organizer_id", targetUserId),
    supabase.from("meeting_attendees").select("meeting_id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("attendance").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("leaves").select("id", { count: "exact", head: true }).eq("user_id", targetUserId),
    supabase.from("leaves").select("id", { count: "exact", head: true }).eq("approved_by", targetUserId),
    supabase.from("resource_allocations").select("id", { count: "exact", head: true }).eq("requested_by", targetUserId),
    supabase.from("resource_allocations").select("id", { count: "exact", head: true }).eq("approved_by", targetUserId),
    supabase.from("project_documents").select("id", { count: "exact", head: true }).eq("uploaded_by", targetUserId),
    supabase.from("safety_incidents").select("id", { count: "exact", head: true }).eq("reported_by", targetUserId),
    supabase.from("safety_incidents").select("id", { count: "exact", head: true }).eq("assigned_to", targetUserId),
    supabase.from("grievances").select("id", { count: "exact", head: true }).eq("submitted_by", targetUserId),
    supabase.from("grievances").select("id", { count: "exact", head: true }).eq("assigned_to", targetUserId),
    supabase.from("daily_progress_reports").select("id", { count: "exact", head: true }).eq("submitted_by", targetUserId),
    supabase.from("project_delays").select("id", { count: "exact", head: true }).eq("reported_by", targetUserId),
    supabase.from("project_delays").select("id", { count: "exact", head: true }).eq("rectified_by", targetUserId),
    supabase.from("signature_acknowledgments").select("id", { count: "exact", head: true }).eq("signed_by", targetUserId),
    supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
    supabase.from("purchase_orders").select("id", { count: "exact", head: true }).eq("approved_by", targetUserId),
    supabase.from("subcontracts").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
    supabase.from("subcontractor_performance_reviews").select("id", { count: "exact", head: true }).eq("reviewed_by", targetUserId),
    supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
    supabase.from("inventory_transactions").select("id", { count: "exact", head: true }).eq("performed_by", targetUserId),
    supabase.from("equipment_assets").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
    supabase.from("equipment_maintenance_logs").select("id", { count: "exact", head: true }).eq("performed_by", targetUserId),
    supabase.from("rfis").select("id", { count: "exact", head: true }).eq("raised_by", targetUserId),
    supabase.from("rfis").select("id", { count: "exact", head: true }).eq("assigned_to", targetUserId),
    supabase.from("change_orders").select("id", { count: "exact", head: true }).eq("requested_by", targetUserId),
    supabase.from("change_orders").select("id", { count: "exact", head: true }).eq("approved_by", targetUserId),
    supabase.from("tenders").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
    supabase.from("bids").select("id", { count: "exact", head: true }).eq("contractor_id", targetUserId),
    supabase.from("bids").select("id", { count: "exact", head: true }).eq("reviewed_by", targetUserId),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", targetUserId),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", targetUserId),
    supabase.from("punch_items").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
    supabase.from("punch_items").select("id", { count: "exact", head: true }).eq("assigned_to", targetUserId),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("logged_by", targetUserId),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("approved_by", targetUserId),
    supabase.from("task_dependencies").select("id", { count: "exact", head: true }).eq("created_by", targetUserId),
  ]);

  if ((taskCount ?? 0) > 0) reasons.push(`Assigned to ${taskCount} task(s)`);
  if ((projectManagerCount ?? 0) > 0) reasons.push(`Manager of ${projectManagerCount} project(s)`);
  if ((projectClientCount ?? 0) > 0) reasons.push(`Linked client on ${projectClientCount} project(s)`);
  if ((organizedMeetingCount ?? 0) > 0) reasons.push(`Organizer of ${organizedMeetingCount} meeting(s)`);
  if ((invitedMeetingCount ?? 0) > 0) reasons.push(`Invited attendee in ${invitedMeetingCount} meeting(s)`);
  if ((notificationCount ?? 0) > 0) reasons.push(`Has ${notificationCount} notification record(s)`);
  if ((attendanceCount ?? 0) > 0) reasons.push(`Has ${attendanceCount} attendance record(s)`);
  if ((leaveUserCount ?? 0) > 0) reasons.push(`Submitted ${leaveUserCount} leave request(s)`);
  if ((leaveApproverCount ?? 0) > 0) reasons.push(`Approver on ${leaveApproverCount} leave request(s)`);
  if ((resourceRequesterCount ?? 0) > 0) reasons.push(`Requested ${resourceRequesterCount} resource allocation(s)`);
  if ((resourceApproverCount ?? 0) > 0) reasons.push(`Approver on ${resourceApproverCount} resource allocation(s)`);
  if ((docCount ?? 0) > 0) reasons.push(`Uploaded ${docCount} project document(s)`);
  if ((safetyReporterCount ?? 0) > 0) reasons.push(`Reported ${safetyReporterCount} safety incident(s)`);
  if ((safetyAssigneeCount ?? 0) > 0) reasons.push(`Assigned to ${safetyAssigneeCount} safety incident(s)`);
  if ((grievanceSubmitterCount ?? 0) > 0) reasons.push(`Submitted ${grievanceSubmitterCount} grievance(s)`);
  if ((grievanceAssigneeCount ?? 0) > 0) reasons.push(`Assigned to ${grievanceAssigneeCount} grievance(s)`);
  if ((dprSubmitterCount ?? 0) > 0) reasons.push(`Submitted ${dprSubmitterCount} daily progress report(s)`);
  if ((delayReporterCount ?? 0) > 0) reasons.push(`Reported ${delayReporterCount} project delay(s)`);
  if ((delayRectifierCount ?? 0) > 0) reasons.push(`Rectified ${delayRectifierCount} project delay(s)`);
  if ((signatureCount ?? 0) > 0) reasons.push(`Signed ${signatureCount} digital acknowledgment(s)`);
  if ((poCreatorCount ?? 0) > 0) reasons.push(`Created ${poCreatorCount} purchase order(s)`);
  if ((poApproverCount ?? 0) > 0) reasons.push(`Approver on ${poApproverCount} purchase order(s)`);
  if ((subcontractCreatorCount ?? 0) > 0) reasons.push(`Created ${subcontractCreatorCount} subcontract(s)`);
  if ((perfReviewerCount ?? 0) > 0) reasons.push(`Wrote ${perfReviewerCount} subcontractor performance review(s)`);
  if ((inventoryItemCreatorCount ?? 0) > 0) reasons.push(`Created ${inventoryItemCreatorCount} inventory item(s)`);
  if ((inventoryTxnCount ?? 0) > 0) reasons.push(`Performed ${inventoryTxnCount} inventory transaction(s)`);
  if ((equipmentCreatorCount ?? 0) > 0) reasons.push(`Created ${equipmentCreatorCount} equipment asset(s)`);
  if ((equipmentLogCount ?? 0) > 0) reasons.push(`Logged ${equipmentLogCount} equipment maintenance record(s)`);
  if ((rfiRaiserCount ?? 0) > 0) reasons.push(`Raised ${rfiRaiserCount} RFI(s)`);
  if ((rfiAssigneeCount ?? 0) > 0) reasons.push(`Assigned to ${rfiAssigneeCount} RFI(s)`);
  if ((changeOrderRequesterCount ?? 0) > 0) reasons.push(`Requested ${changeOrderRequesterCount} change order(s)`);
  if ((changeOrderApproverCount ?? 0) > 0) reasons.push(`Approver on ${changeOrderApproverCount} change order(s)`);
  if ((tenderCreatorCount ?? 0) > 0) reasons.push(`Created ${tenderCreatorCount} tender(s)`);
  if ((bidContractorCount ?? 0) > 0) reasons.push(`Submitted ${bidContractorCount} bid(s)`);
  if ((bidReviewerCount ?? 0) > 0) reasons.push(`Reviewed ${bidReviewerCount} bid(s)`);
  if ((messageSenderCount ?? 0) > 0) reasons.push(`Sent ${messageSenderCount} message(s)`);
  if ((messageRecipientCount ?? 0) > 0) reasons.push(`Received ${messageRecipientCount} message(s)`);
  if ((punchCreatorCount ?? 0) > 0) reasons.push(`Logged ${punchCreatorCount} punch list item(s)`);
  if ((punchAssigneeCount ?? 0) > 0) reasons.push(`Assigned to ${punchAssigneeCount} punch list item(s)`);
  if ((expenseLoggerCount ?? 0) > 0) reasons.push(`Logged ${expenseLoggerCount} expense(s)`);
  if ((expenseApproverCount ?? 0) > 0) reasons.push(`Approver on ${expenseApproverCount} expense(s)`);
  if ((taskDependencyCreatorCount ?? 0) > 0) reasons.push(`Created ${taskDependencyCreatorCount} task dependency link(s)`);

  return {
    canDelete: reasons.length === 0,
    reasons,
    isLastAdmin,
  };
}

export interface AdminOverviewData {
  openGrievances: number;
  openSafetyIncidents: number;
  criticalSafetyIncidents: number;
  pendingLeaves: number;
  pendingResourceRequests: number;
  activeProjects: number;
  totalUsers: number;
}

/**
 * Fetch cross-module pending/open items count for Admin System Overview
 */
export async function getAdminOverviewData(
  supabase: SupabaseClient<Database>
): Promise<AdminOverviewData> {
  const [
    { count: openGrievances },
    { count: openSafetyIncidents },
    { count: criticalSafetyIncidents },
    { count: pendingLeaves },
    { count: pendingResourceRequests },
    { count: activeProjects },
    { count: totalUsers },
  ] = await Promise.all([
    supabase.from("grievances").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("safety_incidents").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    supabase.from("safety_incidents").select("id", { count: "exact", head: true }).eq("severity", "critical").neq("status", "resolved"),
    supabase.from("leaves").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("resource_allocations").select("id", { count: "exact", head: true }).eq("status", "requested"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("users").select("id", { count: "exact", head: true }),
  ]);

  return {
    openGrievances: openGrievances ?? 0,
    openSafetyIncidents: openSafetyIncidents ?? 0,
    criticalSafetyIncidents: criticalSafetyIncidents ?? 0,
    pendingLeaves: pendingLeaves ?? 0,
    pendingResourceRequests: pendingResourceRequests ?? 0,
    activeProjects: activeProjects ?? 0,
    totalUsers: totalUsers ?? 0,
  };
}

