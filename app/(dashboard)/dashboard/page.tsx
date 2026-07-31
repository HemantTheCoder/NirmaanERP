import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProjectsWithProgress } from "@/lib/queries/projects";
import { getUpcomingMeetings } from "@/lib/queries/meetings";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectProgressList } from "@/components/dashboard/ProjectProgressList";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import Link from "next/link";
import type { UserRole } from "@/types/database";
import {
  FolderKanban,
  CheckSquare,
  Users,
  ClipboardList,
  BarChart3,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Overview of your Nirmaan ERP projects, tasks, and team.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profileData } = user
    ? await (supabase.from("users") as any).select("role").eq("id", user.id).single()
    : { data: null };

  const profile = profileData as { role: UserRole } | null;
  const canViewReports = profile?.role === "admin" || profile?.role === "project_manager";

  // Run 5 parallel queries: 4 count queries + project progress + upcoming meetings
  const [
    { count: activeProjectsCount },
    { count: openTasksCount },
    { count: teamMembersCount },
    { count: pendingLeavesCount },
    projectsProgress,
    upcomingMeetings,
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .neq("status", "done"),
    supabase.from("users").select("id", { count: "exact", head: true }),
    supabase
      .from("leaves")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    getProjectsWithProgress(supabase),
    getUpcomingMeetings(supabase, 3),
  ]);

  const activeProjects = activeProjectsCount ?? 0;
  const openTasks = openTasksCount ?? 0;
  const teamMembers = teamMembersCount ?? 0;
  const pendingLeaves = pendingLeavesCount ?? 0;

  const KPI_DATA = [
    {
      id: "kpi-active-projects",
      label: "Active Projects",
      value: activeProjects.toString(),
      change: activeProjects > 0 ? "Live count from DB" : "No active projects",
      trend: "up" as const,
      icon: FolderKanban,
      color: "indigo" as const,
    },
    {
      id: "kpi-open-tasks",
      label: "Open Tasks",
      value: openTasks.toString(),
      change: openTasks > 0 ? "In progress or pending" : "All tasks completed",
      trend: openTasks > 0 ? ("up" as const) : ("neutral" as const),
      icon: CheckSquare,
      color: "emerald" as const,
    },
    {
      id: "kpi-team-members",
      label: "Team Members",
      value: teamMembers.toString(),
      change: teamMembers > 0 ? "Registered users" : "No registered staff",
      trend: "up" as const,
      icon: Users,
      color: "violet" as const,
    },
    {
      id: "kpi-pending-approvals",
      label: "Pending Approvals",
      value: pendingLeaves.toString(),
      change: pendingLeaves > 0 ? "Leave requests pending" : "All caught up",
      trend: pendingLeaves > 0 ? ("down" as const) : ("neutral" as const),
      icon: ClipboardList,
      color: "amber" as const,
      href: canViewReports ? "/approvals" : undefined,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Good morning 👋</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Here&apos;s what&apos;s happening across your projects today.
          </p>
        </div>
        {canViewReports && (
          <Link
            href="/reports"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1.5 rounded-lg border border-indigo-100 dark:border-indigo-900 w-fit"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            View full reports →
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <section aria-label="Key performance indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {KPI_DATA.map((kpi) => (
            <KpiCard key={kpi.id} {...kpi} />
          ))}
        </div>
      </section>

      {/* Bottom row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <ProjectProgressList projects={projectsProgress} />
        </div>
        <div>
          <UpcomingMeetings meetings={upcomingMeetings} />
        </div>
      </div>
    </div>
  );
}
