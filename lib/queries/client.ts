import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ProjectDocumentItem } from "@/lib/queries/documents";

export interface ClientProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: "planning" | "active" | "on_hold" | "completed";
  start_date: string | null;
  end_date: string | null;
  manager_name: string | null;
  client_id: string | null;
  client_approved: boolean;
  client_approved_at: string | null;
  tasks: any[];
  completed_tasks_count: number;
  total_tasks_count: number;
  progress_pct: number;
}

/**
 * Fetch projects linked to the client (client_id = clientId)
 */
export async function getClientProjects(
  supabase: SupabaseClient<Database>,
  clientId: string
): Promise<ClientProjectItem[]> {
  const { data, error } = await (supabase.from("projects") as any)
    .select(`
      *,
      manager:users!projects_manager_id_fkey(full_name),
      tasks(*)
    `)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching client projects:", error);
    return [];
  }

  return data.map((p: any) => {
    const tasksList = p.tasks || [];
    const total = tasksList.length;
    const completed = tasksList.filter((t: any) => t.status === "done").length;
    const progressPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      manager_name: p.manager?.full_name || null,
      client_id: p.client_id,
      client_approved: p.client_approved ?? false,
      client_approved_at: p.client_approved_at || null,
      tasks: tasksList,
      completed_tasks_count: completed,
      total_tasks_count: total,
      progress_pct: progressPct,
    };
  });
}

/**
 * Fetch project documents for client view, EXCLUDING category 'contract'
 */
export async function getClientDocuments(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ProjectDocumentItem[]> {
  const { data, error } = await (supabase.from("project_documents") as any)
    .select(`
      *,
      uploader:users!project_documents_uploaded_by_fkey(full_name, email)
    `)
    .eq("project_id", projectId)
    .neq("category", "contract")
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching client documents:", error);
    return [];
  }

  return data as ProjectDocumentItem[];
}

/**
 * Client sign-off action: sets client_approved = true and client_approved_at = now()
 */
export async function approveProjectProgress(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<{ success: boolean; error?: string; approvedAt?: string }> {
  const nowIso = new Date().toISOString();

  const { error } = await (supabase.from("projects") as any)
    .update({
      client_approved: true,
      client_approved_at: nowIso,
    })
    .eq("id", projectId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, approvedAt: nowIso };
}
