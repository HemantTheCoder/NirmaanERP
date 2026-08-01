import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";

export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";

export interface ProjectWithManager {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  manager_id: string | null;
  created_at: string;
  manager_name?: string | null;
}

export interface ProjectProgressData {
  id: string;
  name: string;
  status: ProjectStatus;
  manager_name: string | null;
  end_date: string | null;
  completed_tasks: number;
  total_tasks: number;
  progress_pct: number;
}

export interface ProjectManagerOption {
  id: string;
  full_name: string | null;
  email: string;
  role: UserRole;
}

/**
 * Fetch all projects with manager's full name
 */
export async function getProjects(
  supabase: SupabaseClient<Database>
): Promise<ProjectWithManager[]> {
  const { data: projects, error } = await supabase
    .from("projects")
    .select(`
      *,
      users!projects_manager_id_fkey (
        full_name,
        email
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching projects:", error);
    return [];
  }

  return (projects || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status as ProjectStatus,
    start_date: p.start_date,
    end_date: p.end_date,
    manager_id: p.manager_id,
    created_at: p.created_at,
    manager_name: p.users?.full_name || p.users?.email || null,
  }));
}

/**
 * Fetch single project by ID with its tasks
 */
export async function getProjectById(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select(`
      *,
      users!projects_manager_id_fkey (
        full_name,
        email
      )
    `)
    .eq("id", id)
    .single();

  if (projError || !project) {
    return null;
  }

  const { data: tasks } = await supabase
    .from("tasks")
    .select(`
      *,
      users (
        full_name,
        email
      )
    `)
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  return {
    project: {
      ...(project as any),
      manager_name: (project as any).users?.full_name || (project as any).users?.email || null,
    },
    tasks: (tasks || []).map((t: any) => ({
      ...t,
      assignee_name: t.users?.full_name || t.users?.email || null,
    })),
  };
}

/**
 * Fetch eligible project managers (users with role project_manager or admin)
 */
export async function getProjectManagers(
  supabase: SupabaseClient<Database>
): Promise<ProjectManagerOption[]> {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role")
    .in("role", ["project_manager", "admin"]);

  if (error) {
    console.error("Error fetching project managers:", error);
    return [];
  }

  return (data || []) as ProjectManagerOption[];
}

/**
 * Fetch projects with computed task progress for dashboard
 */
export async function getProjectsWithProgress(
  supabase: SupabaseClient<Database>
): Promise<ProjectProgressData[]> {
  const projects = await getProjects(supabase);

  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, project_id, status");

  if (error) {
    console.error("Error fetching tasks for progress:", error);
  }

  const taskList = (tasks || []) as { id: string; project_id: string | null; status: string }[];

  return projects.map((p) => {
    const projTasks = taskList.filter((t) => t.project_id === p.id);
    const total_tasks = projTasks.length;
    const completed_tasks = projTasks.filter((t) => t.status === "done").length;
    const progress_pct =
      total_tasks > 0 ? Math.round((completed_tasks / total_tasks) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      manager_name: p.manager_name || null,
      end_date: p.end_date,
      completed_tasks,
      total_tasks,
      progress_pct,
    };
  });
}

/**
 * Create a new project
 */
export async function createProject(
  supabase: SupabaseClient<Database>,
  payload: {
    name: string;
    description?: string;
    status?: ProjectStatus;
    start_date?: string;
    end_date?: string;
    manager_id?: string;
  }
) {
  const { data, error } = await (supabase.from("projects") as any).insert(payload).select().single();
  return { data, error };
}

/**
 * Update an existing project
 */
export async function updateProject(
  supabase: SupabaseClient<Database>,
  id: string,
  payload: Partial<{
    name: string;
    description: string | null;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
    manager_id: string | null;
  }>
) {
  const { data, error } = await (supabase.from("projects") as any)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  return { data, error };
}

/**
 * Delete a project
 */
export async function deleteProject(
  supabase: SupabaseClient<Database>,
  id: string
) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  return { error };
}
