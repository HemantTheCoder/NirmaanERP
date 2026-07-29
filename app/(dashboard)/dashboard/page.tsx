import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getProjectsWithProgress } from "@/lib/queries/projects";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectProgressList } from "@/components/dashboard/ProjectProgressList";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import {
  FolderKanban,
  CheckSquare,
  Users,
  ClipboardList,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Overview of your Nirmaan ERP projects, tasks, and team.",
};

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Run 4 parallel count queries + 1 project progress query
  const [
    { count: activeProjectsCount },
    { count: openTasksCount },
    { count: teamMembersCount },
    { count: pendingLeavesCount },
    projectsProgress,
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
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Good morning 👋</h2>
        <p className="text-slate-500 text-sm mt-0.5">
          Here&apos;s what&apos;s happening across your projects today.
        </p>
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
          <UpcomingMeetings />
        </div>
      </div>
    </div>
  );
}
