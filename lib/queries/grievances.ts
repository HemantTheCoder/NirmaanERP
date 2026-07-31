import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GrievanceCategory, GrievanceStatus } from "@/types/database";

export interface GrievanceItem {
  id: string;
  submitted_by: string;
  category: GrievanceCategory;
  title: string;
  description: string;
  status: GrievanceStatus;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  submitter?: {
    full_name: string | null;
    email: string;
  };
  assignee?: {
    full_name: string | null;
    email: string;
  };
}

export interface SubmitGrievancePayload {
  submitted_by: string;
  category: GrievanceCategory;
  title: string;
  description: string;
}

/**
 * Fetch grievances (own for non-managers, all for admin/PM)
 */
export async function getGrievances(
  supabase: SupabaseClient<Database>,
  params: { userId: string; isManager: boolean }
): Promise<GrievanceItem[]> {
  let query = (supabase.from("grievances") as any)
    .select(`
      *,
      submitter:users!grievances_submitted_by_fkey(full_name, email),
      assignee:users!grievances_assigned_to_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (!params.isManager) {
    query = query.eq("submitted_by", params.userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error fetching grievances:", error);
    return [];
  }

  return data as GrievanceItem[];
}

/**
 * Submit a new grievance / issue report
 */
export async function submitGrievance(
  supabase: SupabaseClient<Database>,
  payload: SubmitGrievancePayload
): Promise<{ success: boolean; error?: string; grievance?: GrievanceItem }> {
  const { data, error } = await (supabase.from("grievances") as any)
    .insert({
      submitted_by: payload.submitted_by,
      category: payload.category,
      title: payload.title.trim(),
      description: payload.description.trim(),
      status: "open",
    })
    .select(`
      *,
      submitter:users!grievances_submitted_by_fkey(full_name, email),
      assignee:users!grievances_assigned_to_fkey(full_name, email)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit issue report" };
  }

  return { success: true, grievance: data as GrievanceItem };
}

/**
 * Update grievance status, assignee, and resolution notes (admin/PM only)
 */
export async function updateGrievanceStatus(
  supabase: SupabaseClient<Database>,
  params: {
    grievanceId: string;
    status: GrievanceStatus;
    assignedTo?: string | null;
    resolutionNotes?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const updatePayload: any = {
    status: params.status,
  };

  if (params.assignedTo !== undefined) {
    updatePayload.assigned_to = params.assignedTo;
  }

  if (params.resolutionNotes !== undefined) {
    updatePayload.resolution_notes = params.resolutionNotes ? params.resolutionNotes.trim() : null;
  }

  if (params.status === "resolved") {
    updatePayload.resolved_at = new Date().toISOString();
  }

  const { error } = await (supabase.from("grievances") as any)
    .update(updatePayload)
    .eq("id", params.grievanceId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
