import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { AnnotationShape } from "@/lib/queries/punch_list";

export type WarrantyClaimStatus = "submitted" | "acknowledged" | "in_progress" | "resolved" | "rejected";

export interface WarrantyClaim {
  id: string;
  project_id: string;
  title: string;
  description: string;
  location_detail: string;
  photo_path: string | null;
  annotation_data: AnnotationShape[] | null;
  status: WarrantyClaimStatus;
  reported_by: string;
  assigned_to: string | null;
  resolution_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  reporter?: { full_name: string; email: string } | null;
  assignee?: { full_name: string; email: string } | null;
}

export async function getProjectWarrantyClaims(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<WarrantyClaim[]> {
  const { data, error } = await (supabase.from("warranty_claims") as any)
    .select(`
      *,
      reporter:users!warranty_claims_reported_by_fkey(full_name, email),
      assignee:users!warranty_claims_assigned_to_fkey(full_name, email)
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching warranty claims:", error);
    return [];
  }

  return (data || []) as WarrantyClaim[];
}

export async function createWarrantyClaim(
  supabase: SupabaseClient<Database>,
  input: {
    project_id: string;
    title: string;
    description: string;
    location_detail: string;
    photo_path?: string | null;
    annotation_data?: AnnotationShape[] | null;
  },
  userId: string
): Promise<{ success: boolean; data?: WarrantyClaim; error?: string }> {
  const { data, error } = await (supabase.from("warranty_claims") as any)
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description.trim(),
      location_detail: input.location_detail.trim(),
      photo_path: input.photo_path || null,
      annotation_data: input.annotation_data || null,
      status: "submitted",
      reported_by: userId,
    })
    .select(`
      *,
      reporter:users!warranty_claims_reported_by_fkey(full_name, email),
      assignee:users!warranty_claims_assigned_to_fkey(full_name, email)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit warranty claim" };
  }

  return { success: true, data: data as WarrantyClaim };
}

export async function updateWarrantyClaimStatus(
  supabase: SupabaseClient<Database>,
  id: string,
  status: WarrantyClaimStatus,
  resolutionNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const updates: Record<string, unknown> = { status };
  if (status === "resolved" || status === "rejected") {
    updates.resolved_at = new Date().toISOString();
    if (resolutionNotes) updates.resolution_notes = resolutionNotes.trim();
  }

  const { error } = await (supabase.from("warranty_claims") as any).update(updates).eq("id", id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function setProjectWarrantyEndDate(
  supabase: SupabaseClient<Database>,
  projectId: string,
  warrantyEndDate: string | null
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("projects") as any)
    .update({ warranty_end_date: warrantyEndDate })
    .eq("id", projectId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
