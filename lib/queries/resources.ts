import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ResourceType, ResourceStatus } from "@/types/database";

export interface ResourceAllocationItem {
  id: string;
  project_id: string;
  resource_type: ResourceType;
  resource_name: string;
  quantity: number;
  unit: string;
  status: ResourceStatus;
  requested_by: string;
  approved_by: string | null;
  requested_date: string;
  notes: string | null;
  created_at: string;
  requester?: {
    full_name: string | null;
    email: string;
  };
  approver?: {
    full_name: string | null;
  };
}

export interface RequestResourcePayload {
  project_id: string;
  resource_type: ResourceType;
  resource_name: string;
  quantity: number;
  unit: string;
  requested_by: string;
  notes?: string;
}

/**
 * Fetch all resource allocations for a specific project
 */
export async function getProjectResources(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ResourceAllocationItem[]> {
  const { data, error } = await (supabase.from("resource_allocations") as any)
    .select(`
      *,
      requester:users!resource_allocations_requested_by_fkey(full_name, email),
      approver:users!resource_allocations_approved_by_fkey(full_name)
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching project resources:", error);
    return [];
  }

  return data as ResourceAllocationItem[];
}

/**
 * Request a new resource allocation for a project
 */
export async function requestResource(
  supabase: SupabaseClient<Database>,
  payload: RequestResourcePayload
): Promise<{ success: boolean; error?: string; resource?: ResourceAllocationItem }> {
  if (payload.quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0." };
  }

  const { data, error } = await (supabase.from("resource_allocations") as any)
    .insert({
      project_id: payload.project_id,
      resource_type: payload.resource_type,
      resource_name: payload.resource_name,
      quantity: payload.quantity,
      unit: payload.unit,
      status: "requested",
      requested_by: payload.requested_by,
      notes: payload.notes || null,
    })
    .select(`
      *,
      requester:users!resource_allocations_requested_by_fkey(full_name, email),
      approver:users!resource_allocations_approved_by_fkey(full_name)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit resource request" };
  }

  return { success: true, resource: data as ResourceAllocationItem };
}

/**
 * Update resource allocation status (Approve, Reject, Mark In-Use, Release)
 */
export async function updateResourceStatus(
  supabase: SupabaseClient<Database>,
  params: {
    resourceId: string;
    status: ResourceStatus;
    approvedBy: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const updatePayload: any = {
    status: params.status,
    approved_by: params.approvedBy,
  };

  const { error } = await (supabase.from("resource_allocations") as any)
    .update(updatePayload)
    .eq("id", params.resourceId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Fetch total count of in-use resource allocations company-wide (for Dashboard KPI)
 */
export async function getInUseResourceCount(
  supabase: SupabaseClient<Database>
): Promise<number> {
  const { count, error } = await supabase
    .from("resource_allocations")
    .select("id", { count: "exact", head: true })
    .eq("status", "in_use");

  if (error) {
    console.error("Error fetching in-use resource count:", error);
    return 0;
  }

  return count ?? 0;
}
