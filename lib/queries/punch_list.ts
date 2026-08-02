import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type PunchItemSeverity = "minor" | "moderate" | "major";
export type PunchItemStatus = "open" | "in_progress" | "resolved" | "verified";

export interface AnnotationShape {
  type: "circle" | "arrow" | "pin";
  x: number; // 0.0 to 1.0 relative coordinate
  y: number; // 0.0 to 1.0 relative coordinate
  radius?: number; // for circle (0.0 to 1.0 relative)
  endX?: number; // for arrow (0.0 to 1.0 relative)
  endY?: number; // for arrow (0.0 to 1.0 relative)
  color?: string;
  label?: string;
}

export interface PunchItem {
  id: string;
  project_id: string;
  title: string;
  description: string;
  location_detail: string;
  severity: PunchItemSeverity;
  status: PunchItemStatus;
  photo_path: string | null;
  annotation_data: AnnotationShape[] | null;
  created_by: string;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
  creator?: {
    full_name: string;
    email: string;
  } | null;
  assignee?: {
    full_name: string;
    email: string;
  } | null;
}

/**
 * Fetch all punch items for a specific project
 */
export async function getProjectPunchItems(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<PunchItem[]> {
  const { data, error } = await (supabase.from("punch_items") as any)
    .select(`
      *,
      creator:users!punch_items_created_by_fkey(full_name, email),
      assignee:users!punch_items_assigned_to_fkey(full_name, email)
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching punch items:", error);
    return [];
  }

  return (data || []) as PunchItem[];
}

/**
 * Upload defect photo to Supabase Storage bucket
 */
export async function uploadPunchPhoto(
  supabase: SupabaseClient<Database>,
  file: File
): Promise<{ publicUrl?: string; error?: string }> {
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File size exceeds 10MB limit." };
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "Invalid file type. Please upload a JPG, PNG, or WEBP image." };
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const fileName = `punch_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("punch-photos")
    .upload(fileName, file, { cacheControl: "3600", upsert: true });

  if (uploadError) {
    console.warn("Storage upload notice:", uploadError.message);
  }

  const { data: publicUrlData } = supabase.storage
    .from("punch-photos")
    .getPublicUrl(fileName);

  return { publicUrl: publicUrlData?.publicUrl || fileName };
}

/**
 * Create a new punch list item
 */
export async function createPunchItem(
  supabase: SupabaseClient<Database>,
  input: {
    project_id: string;
    title: string;
    description: string;
    location_detail: string;
    severity: PunchItemSeverity;
    photo_path?: string | null;
    annotation_data?: AnnotationShape[] | null;
    assigned_to?: string | null;
  },
  userId: string
): Promise<{ success: boolean; data?: PunchItem; error?: string }> {
  const { data, error } = await (supabase.from("punch_items") as any)
    .insert({
      project_id: input.project_id,
      title: input.title.trim(),
      description: input.description.trim(),
      location_detail: input.location_detail.trim(),
      severity: input.severity,
      status: "open",
      photo_path: input.photo_path || null,
      annotation_data: input.annotation_data || null,
      created_by: userId,
      assigned_to: input.assigned_to || null,
    })
    .select(`
      *,
      creator:users!punch_items_created_by_fkey(full_name, email),
      assignee:users!punch_items_assigned_to_fkey(full_name, email)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to create punch item" };
  }

  return { success: true, data: data as PunchItem };
}

/**
 * Update punch item status (open -> in_progress -> resolved -> verified)
 */
export async function updatePunchItemStatus(
  supabase: SupabaseClient<Database>,
  itemId: string,
  status: PunchItemStatus
): Promise<{ success: boolean; error?: string }> {
  const updates: any = {
    status,
  };

  if (status === "resolved" || status === "verified") {
    updates.resolved_at = new Date().toISOString();
  } else {
    updates.resolved_at = null;
  }

  const { error } = await (supabase.from("punch_items") as any)
    .update(updates)
    .eq("id", itemId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch company-wide punch list metrics for Reports / Overview
 */
export async function getPunchListMetrics(
  supabase: SupabaseClient<Database>
): Promise<{
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  verifiedCount: number;
  majorCount: number;
}> {
  const { data, error } = await (supabase.from("punch_items") as any)
    .select("status, severity");

  if (error || !data) {
    return { totalCount: 0, openCount: 0, inProgressCount: 0, resolvedCount: 0, verifiedCount: 0, majorCount: 0 };
  }

  let openCount = 0;
  let inProgressCount = 0;
  let resolvedCount = 0;
  let verifiedCount = 0;
  let majorCount = 0;

  data.forEach((item: any) => {
    if (item.status === "open") openCount++;
    else if (item.status === "in_progress") inProgressCount++;
    else if (item.status === "resolved") resolvedCount++;
    else if (item.status === "verified") verifiedCount++;

    if (item.severity === "major") majorCount++;
  });

  return {
    totalCount: data.length,
    openCount,
    inProgressCount,
    resolvedCount,
    verifiedCount,
    majorCount,
  };
}
