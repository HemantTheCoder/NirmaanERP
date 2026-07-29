import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface TaskWithProject {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  project_id: string | null;
  project_name: string | null;
  assignee_id: string | null;
  due_date: string | null;
  created_at: string;
}

/**
 * Fetch tasks assigned to a specific user
 */
export async function getMyTasks(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<TaskWithProject[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      projects (
        name
      )
    `)
    .eq("assignee_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching user tasks:", error);
    return [];
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as TaskPriority,
    project_id: t.project_id,
    project_name: t.projects?.name || null,
    assignee_id: t.assignee_id,
    due_date: t.due_date,
    created_at: t.created_at,
  }));
}

/**
 * Create a new task
 */
export async function createTask(
  supabase: SupabaseClient<Database>,
  payload: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    project_id?: string;
    assignee_id: string;
    due_date?: string;
  }
) {
  const { data, error } = await (supabase.from("tasks") as any)
    .insert(payload)
    .select(`
      *,
      projects (
        name
      )
    `)
    .single();

  if (data) {
    return {
      data: {
        ...data,
        project_name: data.projects?.name || null,
      } as TaskWithProject,
      error: null,
    };
  }

  return { data: null, error };
}

/**
 * Update task status
 */
export async function updateTaskStatus(
  supabase: SupabaseClient<Database>,
  taskId: string,
  status: TaskStatus
) {
  const { data, error } = await (supabase.from("tasks") as any)
    .update({ status })
    .eq("id", taskId)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a task
 */
export async function deleteTask(
  supabase: SupabaseClient<Database>,
  taskId: string
) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  return { error };
}
