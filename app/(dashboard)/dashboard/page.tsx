import type { Metadata } from "next";
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

const KPI_DATA = [
  {
    id: "kpi-active-projects",
    label: "Active Projects",
    value: "12",
    change: "+2 this month",
    trend: "up" as const,
    icon: FolderKanban,
    color: "indigo" as const,
  },
  {
    id: "kpi-open-tasks",
    label: "Open Tasks",
    value: "47",
    change: "-8 from last week",
    trend: "down" as const,
    icon: CheckSquare,
    color: "emerald" as const,
  },
  {
    id: "kpi-team-members",
    label: "Team Members",
    value: "23",
    change: "+1 this week",
    trend: "up" as const,
    icon: Users,
    color: "violet" as const,
  },
  {
    id: "kpi-pending-approvals",
    label: "Pending Approvals",
    value: "5",
    change: "Needs attention",
    trend: "neutral" as const,
    icon: ClipboardList,
    color: "amber" as const,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Good morning 👋</h2>
        <p className="text-muted-foreground text-sm mt-0.5">
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
          <ProjectProgressList />
        </div>
        <div>
          <UpcomingMeetings />
        </div>
      </div>
    </div>
  );
}
