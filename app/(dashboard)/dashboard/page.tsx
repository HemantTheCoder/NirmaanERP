import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectsWithProgress } from "@/lib/queries/projects";
import { getUpcomingMeetings } from "@/lib/queries/meetings";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { ProjectProgressList } from "@/components/dashboard/ProjectProgressList";
import { UpcomingMeetings } from "@/components/dashboard/UpcomingMeetings";
import Link from "next/link";
import { getInUseResourceCount } from "@/lib/queries/resources";
import { getClientProjects, getClientDocuments } from "@/lib/queries/client";
import { ClientPortalView } from "@/components/client/ClientPortalView";
import type { UserRole } from "@/types/database";
import { getReportsData } from "@/lib/queries/reports";
import {
  FolderKanban,
  CheckSquare,
  Users,
  ClipboardList,
  BarChart3,
  Package,
  Clock,
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
    ? await (supabase.from("users") as any).select("full_name, role").eq("id", user.id).single()
    : { data: null };

  const profile = profileData as { full_name: string | null; role: UserRole } | null;

  // ── CLIENT ROLE ROUTING ──────────────────────────────────────────────────────
  if (profile?.role === "client" && user) {
    const clientProjects = await getClientProjects(supabase, user.id);
    const activeProject = clientProjects[0];

    const [clientDocs, upcomingMeetings] = await Promise.all([
      activeProject ? getClientDocuments(supabase, activeProject.id) : Promise.resolve([]),
      getUpcomingMeetings(supabase, 5),
    ]);

    return (
      <ClientPortalView
        user={{
          id: user.id,
          email: user.email || "",
          full_name: profile.full_name,
        }}
        projects={clientProjects}
        initialDocuments={clientDocs}
        meetings={upcomingMeetings}
      />
    );
  }

  // ── CONTRACTOR ROLE ROUTING ─────────────────────────────────────────────────
  if (profile?.role === "contractor") {
    redirect("/tenders");
  }

  const canViewReports = profile?.role === "admin" || profile?.role === "project_manager";

  // Run 7 parallel queries: 5 count queries + project progress + upcoming meetings + reports KPIs
  const [
    { count: activeProjectsCount },
    { count: openTasksCount },
    { count: teamMembersCount },
    { count: pendingLeavesCount },
    inUseResources,
    projectsProgress,
    upcomingMeetings,
    reportsKpis,
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
    getInUseResourceCount(supabase),
    getProjectsWithProgress(supabase),
    getUpcomingMeetings(supabase, 3),
    getReportsData(supabase, { dateRange: "all" }),
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
      id: "kpi-resources-in-use",
      label: "Resources In-Use",
      value: inUseResources.toString(),
      change: inUseResources > 0 ? "Allocated site assets" : "No active allocations",
      trend: "up" as const,
      icon: Package,
      color: "indigo" as const,
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
    {
      id: "kpi-on-time-rate",
      label: "On-Time Completion",
      value: `${reportsKpis.onTimeCompletion.rate}%`,
      change:
        reportsKpis.onTimeCompletion.totalCompletedWithDueDate > 0
          ? `${reportsKpis.onTimeCompletion.onTimeCount} of ${reportsKpis.onTimeCompletion.totalCompletedWithDueDate} tasks on time`
          : "No tasks with due dates yet",
      trend:
        reportsKpis.onTimeCompletion.rate >= 70
          ? ("up" as const)
          : reportsKpis.onTimeCompletion.rate >= 40
          ? ("neutral" as const)
          : ("down" as const),
      icon: Clock,
      color: "emerald" as const,
      href: canViewReports ? "/reports" : undefined,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {(() => {
              const hour =
                Number(
                  new Intl.DateTimeFormat("en-US", {
                    hour: "numeric",
                    hour12: false,
                    timeZone: "Asia/Kolkata",
                  }).format(new Date())
                ) % 24;
              const period =
                hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
              const firstName = profile?.full_name?.split(" ")[0] ?? null;
              return `Good ${period}${firstName ? `, ${firstName}` : ""} 👋`;
            })()}
          </h2>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
