import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { PPC_TARGET_PERCENT } from "./dpr";
import { getAllDelays, averageDaysToRectify, type ProjectDelay } from "./delays";

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

export interface OnTimeCompletionRateData {
  rate: number;
  onTimeCount: number;
  totalCompletedWithDueDate: number;
}

export interface PpcTrendItem {
  weekLabel: string;
  ppc: number;
  dueCount: number;
  completedOnTimeCount: number;
}

export interface ResourceUtilizationData {
  utilizationPct: number;
  inUseCount: number;
  idleApprovedCount: number;
  requestedCount: number;
  totalActiveCount: number;
}

export interface PunchListMetricsData {
  totalCount: number;
  openCount: number;
  inProgressCount: number;
  resolvedCount: number;
  majorCount: number;
}

/**
 * Daily Percent Plan Complete from the DPR checklist (planned vs. actually
 * completed line items on a given day), distinct from `ppcTrend` above —
 * that one is a weekly task-due-date reliability rate. Both are labeled
 * "PPC" in construction PM usage but computed from different data, so the
 * UI keeps them visually and textually separate rather than merging them.
 */
export interface DailyPpcTrendItem {
  date: string; // YYYY-MM-DD
  ppc: number;
  projectId: string;
  projectName: string;
}

export interface DaysBelowTargetItem {
  projectId: string;
  projectName: string;
  daysBelowTarget: number;
  totalDaysReported: number;
}

export interface DelayMetrics {
  delayLog: ProjectDelay[];
  daysBelowTargetByProject: DaysBelowTargetItem[];
  avgDaysToRectifyPortfolio: number | null;
  avgDaysToRectifyByProject: { projectId: string; projectName: string; avgDays: number | null }[];
  openDelayCount: number;
}

export interface ReportsAggregateData {
  projectStatus: ProjectStatusItem[];
  completionTrend: TaskCompletionTrendItem[];
  trendSubtitle: string;
  teamWorkload: TeamWorkloadItem[];
  projectProgress: ProjectProgressComparisonItem[];
  projectsList: ProjectOption[];
  onTimeCompletion: OnTimeCompletionRateData;
  ppcTrend: PpcTrendItem[];
  resourceUtilization: ResourceUtilizationData;
  punchListMetrics?: PunchListMetricsData;
  dailyPpcTrend: DailyPpcTrendItem[];
  delayMetrics: DelayMetrics;
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

  // ── 5. On-Time Task Completion Rate ─────────────────────────────────────────
  const allTasksWithDueDateQuery = (supabase.from("tasks") as any)
    .select("id, status, due_date, completed_at, updated_at, created_at, project_id")
    .not("due_date", "is", null);

  if (projectId) {
    allTasksWithDueDateQuery.eq("project_id", projectId);
  }

  const { data: tasksWithDueDateRaw } = await allTasksWithDueDateQuery;
  const tasksWithDueDate = tasksWithDueDateRaw || [];

  const completedWithDueDate = tasksWithDueDate.filter((t: any) => t.status === "done");
  const onTimeTasks = completedWithDueDate.filter((t: any) => {
    const compDateStr = t.completed_at || t.updated_at || t.created_at;
    if (!compDateStr || !t.due_date) return false;
    return new Date(compDateStr).getTime() <= new Date(t.due_date).getTime() + 86400000; // end of due day
  });

  const onTimeCompletion: OnTimeCompletionRateData = {
    rate: completedWithDueDate.length > 0 ? Math.round((onTimeTasks.length / completedWithDueDate.length) * 100) : 0,
    onTimeCount: onTimeTasks.length,
    totalCompletedWithDueDate: completedWithDueDate.length,
  };

  // ── 6. Percent Plan Complete (PPC - Last Planner System Weekly Trend) ─────────
  // Uses the exact same weekly time windows (wStart -> wEnd) as completionTrend
  const ppcTrend: PpcTrendItem[] = [];

  for (let i = 0; i < numWeeks; i++) {
    const wStart = new Date(startDate.getTime() + i * 7 * 24 * 60 * 60 * 1000);
    const wEnd = new Date(startDate.getTime() + (i + 1) * 7 * 24 * 60 * 60 * 1000);

    const weekLabel = `${wStart.getDate()} ${wStart.toLocaleString("en-US", { month: "short" })}`;

    // Tasks due in this specific week
    const dueInWeek = tasksWithDueDate.filter((t: any) => {
      if (!t.due_date) return false;
      const dDate = new Date(t.due_date);
      return dDate >= wStart && dDate < wEnd;
    });

    // Of tasks due this week, how many were completed in this same week or on time
    const completedOnTimeInWeek = dueInWeek.filter((t: any) => {
      if (t.status !== "done") return false;
      const compDateStr = t.completed_at || t.updated_at || t.created_at;
      if (!compDateStr) return false;
      const cDate = new Date(compDateStr);
      return cDate >= wStart && cDate < wEnd && cDate.getTime() <= new Date(t.due_date).getTime() + 86400000;
    });

    const ppcVal = dueInWeek.length > 0 ? Math.round((completedOnTimeInWeek.length / dueInWeek.length) * 100) : 0;

    ppcTrend.push({
      weekLabel,
      ppc: ppcVal,
      dueCount: dueInWeek.length,
      completedOnTimeCount: completedOnTimeInWeek.length,
    });
  }

  // ── 7. Resource Utilization Rate ─────────────────────────────────────────────
  const resourceQuery = (supabase.from("resource_allocations") as any).select("id, status, quantity, project_id");
  if (projectId) {
    resourceQuery.eq("project_id", projectId);
  }

  const { data: resourceRaw } = await resourceQuery;
  const resourceList = resourceRaw || [];

  let inUseCount = 0;
  let idleApprovedCount = 0;
  let requestedCount = 0;

  resourceList.forEach((r: any) => {
    const q = Number(r.quantity) || 1;
    if (r.status === "in_use") inUseCount += q;
    else if (r.status === "approved") idleApprovedCount += q;
    else if (r.status === "requested") requestedCount += q;
  });

  const totalActiveCount = inUseCount + idleApprovedCount + requestedCount;
  const utilizationPct = totalActiveCount > 0 ? Math.round((inUseCount / totalActiveCount) * 100) : 0;

  const resourceUtilization: ResourceUtilizationData = {
    utilizationPct,
    inUseCount,
    idleApprovedCount,
    requestedCount,
    totalActiveCount,
  };

  // ── 8. Quality Control & Punch List Metrics ──────────────────────────────────
  const punchQuery = (supabase.from("punch_items") as any).select("status, severity, project_id");
  if (projectId) {
    punchQuery.eq("project_id", projectId);
  }

  const { data: punchRaw } = await punchQuery;
  const punchList = punchRaw || [];

  let punchOpen = 0;
  let punchInProgress = 0;
  let punchResolved = 0;
  let punchMajor = 0;

  punchList.forEach((p: any) => {
    if (p.status === "open") punchOpen++;
    else if (p.status === "in_progress") punchInProgress++;
    else if (p.status === "resolved" || p.status === "verified") punchResolved++;

    if (p.severity === "major") punchMajor++;
  });

  const punchListMetrics: PunchListMetricsData = {
    totalCount: punchList.length,
    openCount: punchOpen,
    inProgressCount: punchInProgress,
    resolvedCount: punchResolved,
    majorCount: punchMajor,
  };

  // ── 7. Delays & PPC (checklist-based) ─────────────────────────────────────────
  const projectNameById = new Map(projectsList.map((p) => [p.id, p.name]));

  const dprQuery = (supabase.from("daily_progress_reports") as any)
    .select("project_id, report_date, dpr_checklist_items ( is_completed )")
    .gte("report_date", startDate.toISOString().split("T")[0]);
  if (projectId) {
    dprQuery.eq("project_id", projectId);
  }
  const { data: dprRows, error: dprError } = await dprQuery;
  if (dprError) {
    console.error("Error fetching DPR checklist data for reports:", dprError);
  }

  const dailyPpcTrend: DailyPpcTrendItem[] = [];
  const belowTargetCountByProject = new Map<string, number>();
  const totalReportedByProject = new Map<string, number>();

  for (const row of dprRows || []) {
    const items = (row.dpr_checklist_items || []) as { is_completed: boolean }[];
    if (items.length === 0) continue; // no plan recorded that day — not a 0%, just no data

    const completed = items.filter((i) => i.is_completed).length;
    const ppc = Math.round((completed / items.length) * 1000) / 10;
    const projectName = projectNameById.get(row.project_id) ?? "Unknown Project";

    dailyPpcTrend.push({ date: row.report_date, ppc, projectId: row.project_id, projectName });

    totalReportedByProject.set(row.project_id, (totalReportedByProject.get(row.project_id) ?? 0) + 1);
    if (ppc < PPC_TARGET_PERCENT) {
      belowTargetCountByProject.set(row.project_id, (belowTargetCountByProject.get(row.project_id) ?? 0) + 1);
    }
  }

  dailyPpcTrend.sort((a, b) => a.date.localeCompare(b.date));

  const daysBelowTargetByProject: DaysBelowTargetItem[] = Array.from(totalReportedByProject.entries())
    .map(([pid, total]) => ({
      projectId: pid,
      projectName: projectNameById.get(pid) ?? "Unknown Project",
      daysBelowTarget: belowTargetCountByProject.get(pid) ?? 0,
      totalDaysReported: total,
    }))
    .sort((a, b) => b.daysBelowTarget - a.daysBelowTarget);

  // Delay log intentionally ignores the date-range filter — a delay reported
  // outside the current window but still open is exactly what a PM needs to
  // see, not something a "last 30 days" filter should hide.
  const allDelays = await getAllDelays(supabase);
  const delayLog = projectId ? allDelays.filter((d) => d.project_id === projectId) : allDelays;

  const delaysByProject = new Map<string, ProjectDelay[]>();
  for (const d of delayLog) {
    const list = delaysByProject.get(d.project_id) ?? [];
    list.push(d);
    delaysByProject.set(d.project_id, list);
  }

  const avgDaysToRectifyByProject = Array.from(delaysByProject.entries()).map(([pid, ds]) => ({
    projectId: pid,
    projectName: projectNameById.get(pid) ?? "Unknown Project",
    avgDays: averageDaysToRectify(ds),
  }));

  const delayMetrics: DelayMetrics = {
    delayLog,
    daysBelowTargetByProject,
    avgDaysToRectifyPortfolio: averageDaysToRectify(delayLog),
    avgDaysToRectifyByProject,
    openDelayCount: delayLog.filter((d) => d.status === "open").length,
  };

  return {
    projectStatus,
    completionTrend,
    trendSubtitle,
    teamWorkload,
    projectProgress,
    projectsList,
    onTimeCompletion,
    ppcTrend,
    resourceUtilization,
    punchListMetrics,
    dailyPpcTrend,
    delayMetrics,
  };
}
