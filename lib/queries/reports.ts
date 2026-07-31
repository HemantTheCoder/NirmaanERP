import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export type DateRangeFilter = "30d" | "60d" | "90d" | "all";

export interface ProjectStatusItem {
  status: string;
  label: string;
  count: number;
  color: string;
}

export interface TaskCompletionTrendItem {
  weekLabel: string;
  completed: number;
}

export interface TeamWorkloadItem {
  userId: string;
  name: string;
  openTasks: number;
}

export interface ProjectProgressComparisonItem {
  id: string;
  name: string;
  status: string;
  progressPercent: number;
  completedTasks: number;
  totalTasks: number;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface ReportsAggregateData {
  projectStatus: ProjectStatusItem[];
  completionTrend: TaskCompletionTrendItem[];
  trendSubtitle: string;
  teamWorkload: TeamWorkloadItem[];
  projectProgress: ProjectProgressComparisonItem[];
  projectsList: ProjectOption[];
}

const STATUS_COLOR_MAP: Record<string, { label: string; color: string }> = {
  planning:  { label: "Planning", color: "#f59e0b" },  // Amber-500
  active:    { label: "Active", color: "#4f46e5" },    // Indigo-600
  on_hold:   { label: "On Hold", color: "#f43f5e" },   // Rose-500
  completed: { label: "Completed", color: "#10b981" }, // Emerald-500
};

export async function getReportsData(
  supabase: SupabaseClient<Database>,
  filters: { dateRange?: DateRangeFilter; projectId?: string } = {}
): Promise<ReportsAggregateData> {
  const dateRange = filters.dateRange ?? "60d";
  const projectId = filters.projectId && filters.projectId !== "all" ? filters.projectId : undefined;

  // ── 1. Projects filter options & status breakdown ────────────────────────────
  const projectsQuery = (supabase.from("projects") as any).select("id, name, status");
  if (projectId) {
    projectsQuery.eq("id", projectId);
  }
  const { data: rawProjects } = await projectsQuery;
  const projects = rawProjects || [];

  // Also get full list of projects for dropdown
  const { data: allProjectsData } = await (supabase.from("projects") as any)
    .select("id, name")
    .order("name", { ascending: true });
  const projectsList: ProjectOption[] = (allProjectsData || []).map((p: any) => ({
    id: p.id,
    name: p.name,
  }));

  // Tally project statuses
  const statusCounts: Record<string, number> = {
    planning: 0,
    active: 0,
    on_hold: 0,
    completed: 0,
  };
  projects.forEach((p: any) => {
    if (statusCounts[p.status] !== undefined) {
      statusCounts[p.status] += 1;
    }
  });

  const projectStatus: ProjectStatusItem[] = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    label: STATUS_COLOR_MAP[status]?.label ?? status,
    count,
    color: STATUS_COLOR_MAP[status]?.color ?? "#64748b",
  }));

  // ── 2. Task Completion Trend (Dynamic by date range filter) ──────────────────
  const now = new Date();
  let daysWindow = 60;
  let trendSubtitle = "Weekly completions over the last 60 days (8 weeks)";

  if (dateRange === "30d") {
    daysWindow = 30;
    trendSubtitle = "Weekly completions over the last 30 days";
  } else if (dateRange === "60d") {
    daysWindow = 60;
    trendSubtitle = "Weekly completions over the last 60 days";
  } else if (dateRange === "90d") {
    daysWindow = 90;
    trendSubtitle = "Weekly completions over the last 90 days";
  } else if (dateRange === "all") {
    daysWindow = 120;
    trendSubtitle = "Weekly completions over the last 120 days";
  }

  const startDate = new Date(now.getTime() - daysWindow * 24 * 60 * 60 * 1000);

  // Fetch completed tasks (gracefully fall back to created_at if migration 0005 not applied yet)
  const tasksDoneQuery = (supabase.from("tasks") as any)
    .select("id, status, completed_at, updated_at, created_at, project_id")
    .eq("status", "done");

  if (projectId) {
    tasksDoneQuery.eq("project_id", projectId);
  }

  let doneTasksRaw: any[] | null = null;
  const { data: primaryData, error: primaryErr } = await tasksDoneQuery;

  if (primaryErr) {
    console.warn("Failed to query completed_at/updated_at columns. Falling back to created_at:", primaryErr.message);
    const fallbackQuery = (supabase.from("tasks") as any)
      .select("id, status, created_at, project_id")
      .eq("status", "done");

    if (projectId) {
      fallbackQuery.eq("project_id", projectId);
    }
    const { data: fallbackData } = await fallbackQuery;
    doneTasksRaw = fallbackData || [];
  } else {
    doneTasksRaw = primaryData || [];
  }

  const doneTasks = doneTasksRaw || [];

  // Group completed tasks into 7-day week buckets starting from startDate
  const numWeeks = Math.ceil(daysWindow / 7);
  const completionTrend: TaskCompletionTrendItem[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const wStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const wEnd = new Date(startDate.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000);

    const weekLabel = `${wStart.getDate()} ${wStart.toLocaleString("en-US", { month: "short" })}`;

    const count = doneTasks.filter((t: any) => {
      const dateStr = t.completed_at || t.updated_at || t.created_at;
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d >= wStart && d < wEnd;
    }).length;

    completionTrend.push({ weekLabel, completed: count });
  }

  // ── 3. Team Workload (Open tasks per team member) ───────────────────────────
  const openTasksQuery = (supabase.from("tasks") as any)
    .select("id, status, assignee_id, users(id, full_name, email)")
    .neq("status", "done");

  if (projectId) {
    openTasksQuery.eq("project_id", projectId);
  }

  const { data: openTasksRaw } = await openTasksQuery;
  const openTasksList = openTasksRaw || [];

  const workloadMap: Record<string, { name: string; count: number }> = {};

  openTasksList.forEach((t: any) => {
    const u = t.users;
    const name = u?.full_name ?? u?.email ?? (t.assignee_id ? "Assigned Staff" : "Unassigned");
    const key = t.assignee_id ?? "unassigned";

    if (!workloadMap[key]) {
      workloadMap[key] = { name, count: 0 };
    }
    workloadMap[key].count += 1;
  });

  const teamWorkload: TeamWorkloadItem[] = Object.entries(workloadMap)
    .map(([userId, val]) => ({
      userId,
      name: val.name,
      openTasks: val.count,
    }))
    .sort((a, b) => b.openTasks - a.openTasks);

  // ── 4. Project Progress Comparison ──────────────────────────────────────────
  const tasksForProjectsQuery = (supabase.from("tasks") as any).select("id, status, project_id");
  if (projectId) {
    tasksForProjectsQuery.eq("project_id", projectId);
  }

  const { data: allTasksRaw } = await tasksForProjectsQuery;
  const allTasks = allTasksRaw || [];

  const projectProgress: ProjectProgressComparisonItem[] = projects.map((p: any) => {
    const pTasks = allTasks.filter((t: any) => t.project_id === p.id);
    const total = pTasks.length;
    const completed = pTasks.filter((t: any) => t.status === "done").length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      status: p.status,
      progressPercent: percent,
      completedTasks: completed,
      totalTasks: total,
    };
  });

  return {
    projectStatus,
    completionTrend,
    trendSubtitle,
    teamWorkload,
    projectProgress,
    projectsList,
  };
}
