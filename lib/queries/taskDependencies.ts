import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export interface TaskDependencyLink {
  id: string;
  task_id: string;
  depends_on_task_id: string;
}

/**
 * Fetch dependency links for a project, scoped by the dependent task
 * (task_id) belonging to this project's task list. See
 * lib/utils/criticalPath.ts for the cross-project stale-link guard applied
 * on top of this when computing the critical path.
 */
export async function getProjectTaskDependencies(
  supabase: SupabaseClient<Database>,
  taskIds: string[]
): Promise<TaskDependencyLink[]> {
  if (taskIds.length === 0) return [];

  const { data, error } = await (supabase.from("task_dependencies") as any)
    .select("id, task_id, depends_on_task_id")
    .in("task_id", taskIds);

  if (error) {
    console.error("Error fetching task dependencies:", error);
    return [];
  }

  return (data || []) as TaskDependencyLink[];
}

/**
 * Link a predecessor onto a task. The acyclic check runs client-side first
 * (see wouldCreateCycle in criticalPath.ts) purely for UX — the DB trigger
 * (trg_task_dependencies_acyclic) is the actual guarantee and will reject
 * this with a Postgres exception if the client-side check was stale.
 */
export async function addTaskDependency(
  supabase: SupabaseClient<Database>,
  taskId: string,
  dependsOnTaskId: string,
  createdBy: string
): Promise<{ success: boolean; data?: TaskDependencyLink; error?: string }> {
  const { data, error } = await (supabase.from("task_dependencies") as any)
    .insert({ task_id: taskId, depends_on_task_id: dependsOnTaskId, created_by: createdBy })
    .select("id, task_id, depends_on_task_id")
    .single();

  if (error) {
    // The trigger's cycle-rejection message is already human-readable;
    // anything else (RLS denial, duplicate link) gets its own message too.
    return { success: false, error: error.message };
  }

  return { success: true, data: data as TaskDependencyLink };
}

export async function removeTaskDependency(
  supabase: SupabaseClient<Database>,
  linkId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await (supabase.from("task_dependencies") as any).delete().eq("id", linkId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
