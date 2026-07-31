import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface LeaveItem {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  type: "casual" | "sick" | "earned" | "unpaid";
  status: "pending" | "approved" | "rejected";
  reason: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  user?: {
    full_name: string | null;
    email: string;
  };
  approver?: {
    full_name: string | null;
  };
}

export interface RequestLeavePayload {
  user_id: string;
  start_date: string;
  end_date: string;
  type: "casual" | "sick" | "earned" | "unpaid";
  reason: string;
}

/**
 * Fetch all leave requests submitted by the logged-in user
 */
export async function getMyLeaves(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<LeaveItem[]> {
  const { data, error } = await (supabase.from("leaves") as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching my leaves:", error);
    return [];
  }

  return data as LeaveItem[];
}

/**
 * Submit a new leave request
 */
export async function requestLeave(
  supabase: SupabaseClient<Database>,
  payload: RequestLeavePayload
): Promise<{ success: boolean; error?: string; leave?: LeaveItem }> {
  const { data, error } = await (supabase.from("leaves") as any)
    .insert({
      user_id: payload.user_id,
      start_date: payload.start_date,
      end_date: payload.end_date,
      type: payload.type,
      reason: payload.reason,
      status: "pending",
    })
    .select("*")
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit leave request" };
  }

  return { success: true, leave: data as LeaveItem };
}

/**
 * Fetch all pending leave requests (for admin/PM approval queue)
 */
export async function getAllPendingLeaves(
  supabase: SupabaseClient<Database>
): Promise<LeaveItem[]> {
  const { data, error } = await (supabase.from("leaves") as any)
    .select("*, user:users!leaves_user_id_fkey(full_name, email)")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching pending leaves:", error);
    return [];
  }

  return data as LeaveItem[];
}

/**
 * Fetch all processed leave requests (approved or rejected)
 */
export async function getAllLeaveHistory(
  supabase: SupabaseClient<Database>
): Promise<LeaveItem[]> {
  const { data, error } = await (supabase.from("leaves") as any)
    .select("*, user:users!leaves_user_id_fkey(full_name, email), approver:users!leaves_approved_by_fkey(full_name)")
    .in("status", ["approved", "rejected"])
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching leave history:", error);
    return [];
  }

  return data as LeaveItem[];
}

/**
 * Approve or reject a leave request
 */
export async function updateLeaveStatus(
  supabase: SupabaseClient<Database>,
  params: {
    leaveId: string;
    status: "approved" | "rejected";
    approvedBy: string;
    rejectionReason?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("leaves") as any)
    .update({
      status: params.status,
      approved_by: params.approvedBy,
      rejection_reason: params.rejectionReason || null,
    })
    .eq("id", params.leaveId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
