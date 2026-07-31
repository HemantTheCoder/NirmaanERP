import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, IncidentType, IncidentSeverity, IncidentStatus } from "@/types/database";

export interface SafetyIncidentItem {
  id: string;
  project_id: string | null;
  project_name?: string | null;
  reported_by: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location_detail: string;
  corrective_action: string | null;
  status: IncidentStatus;
  assigned_to: string | null;
  created_at: string;
  closed_at: string | null;
  reporter?: {
    full_name: string | null;
    email: string;
  };
  assignee?: {
    full_name: string | null;
    email: string;
  };
}

export interface ReportSafetyPayload {
  project_id?: string | null;
  reported_by: string;
  incident_type: IncidentType;
  severity: IncidentSeverity;
  title: string;
  description: string;
  location_detail: string;
}

/**
 * Fetch safety incidents & near-misses
 */
export async function getSafetyIncidents(
  supabase: SupabaseClient<Database>,
  params: { userId: string; isManager: boolean }
): Promise<SafetyIncidentItem[]> {
  let query = (supabase.from("safety_incidents") as any)
    .select(`
      *,
      project:projects(name),
      reporter:users!safety_incidents_reported_by_fkey(full_name, email),
      assignee:users!safety_incidents_assigned_to_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false });

  if (!params.isManager) {
    query = query.eq("reported_by", params.userId);
  }

  const { data, error } = await query;

  if (error || !data) {
    console.error("Error fetching safety incidents:", error);
    return [];
  }

  return data.map((item: any) => ({
    ...item,
    project_name: item.project?.name || null,
  })) as SafetyIncidentItem[];
}

/**
 * Submit a new safety incident or near-miss report
 */
export async function reportSafetyIncident(
  supabase: SupabaseClient<Database>,
  payload: ReportSafetyPayload
): Promise<{ success: boolean; error?: string; incident?: SafetyIncidentItem }> {
  const { data, error } = await (supabase.from("safety_incidents") as any)
    .insert({
      project_id: payload.project_id || null,
      reported_by: payload.reported_by,
      incident_type: payload.incident_type,
      severity: payload.severity,
      title: payload.title.trim(),
      description: payload.description.trim(),
      location_detail: payload.location_detail.trim(),
      status: "reported",
    })
    .select(`
      *,
      project:projects(name),
      reporter:users!safety_incidents_reported_by_fkey(full_name, email),
      assignee:users!safety_incidents_assigned_to_fkey(full_name, email)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to submit safety report" };
  }

  return {
    success: true,
    incident: {
      ...data,
      project_name: data.project?.name || null,
    } as SafetyIncidentItem,
  };
}

/**
 * Update safety incident status, assignee, and corrective action notes (admin/PM only)
 */
export async function updateSafetyIncidentStatus(
  supabase: SupabaseClient<Database>,
  params: {
    incidentId: string;
    status: IncidentStatus;
    assignedTo?: string | null;
    correctiveAction?: string | null;
  }
): Promise<{ success: boolean; error?: string }> {
  const updatePayload: any = {
    status: params.status,
  };

  if (params.assignedTo !== undefined) {
    updatePayload.assigned_to = params.assignedTo;
  }

  if (params.correctiveAction !== undefined) {
    updatePayload.corrective_action = params.correctiveAction ? params.correctiveAction.trim() : null;
  }

  if (params.status === "closed") {
    updatePayload.closed_at = new Date().toISOString();
  }

  const { error } = await (supabase.from("safety_incidents") as any)
    .update(updatePayload)
    .eq("id", params.incidentId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
