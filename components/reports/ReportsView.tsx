"use client";

import { useState, useCallback, useTransition } from "react";
import {
  Download,
  Printer,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Users,
  CheckCircle2,
  Loader2,
  Clock,
  Target,
  Cpu,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import {
  getReportsData,
  type DateRangeFilter,
  type ReportsAggregateData,
} from "@/lib/queries/reports";
import type { CompanyBudgetAnalytics } from "@/lib/queries/finance";
import { cn } from "@/lib/utils";

interface ReportsViewProps {
  initialData: ReportsAggregateData;
  budgetAnalytics?: CompanyBudgetAnalytics;
}

const DATE_RANGE_OPTIONS: { value: DateRangeFilter; label: string }[] = [
  { value: "30d", label: "Last 30 Days" },
  { value: "60d", label: "Last 60 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
];

/** Helper function to download CSV data */
function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(",")).join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function ReportsView({ initialData, budgetAnalytics }: ReportsViewProps) {
  const supabase = createClient();
  const [data, setData] = useState<ReportsAggregateData>(initialData);
  const [dateRange, setDateRange] = useState<DateRangeFilter>("60d");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const handleFilterChange = useCallback(
    (newDateRange: DateRangeFilter, newProjectId: string) => {
      startTransition(async () => {
        const updated = await getReportsData(supabase, {
          dateRange: newDateRange,
          projectId: newProjectId,
        });
        setData(updated);
      });
    },
    [supabase]
  );

  const onDateRangeChange = (val: DateRangeFilter) => {
    setDateRange(val);
    handleFilterChange(val, selectedProject);
  };

  const onProjectChange = (val: string) => {
    setSelectedProject(val);
    handleFilterChange(dateRange, val);
  };

  // ── CSV Export Handlers ─────────────────────────────────────────────────────

  const exportProjectStatusCsv = () => {
    const rows = [
      ["Status", "Count"],
      ...data.projectStatus.map((item) => [item.label, item.count]),
    ];
    downloadCsv("project_status_breakdown", rows);
  };

  const exportCompletionTrendCsv = () => {
    const rows = [
      ["Week Starting", "Completed Tasks"],
      ...data.completionTrend.map((item) => [item.weekLabel, item.completed]),
    ];
    downloadCsv("task_completion_trend", rows);
  };

  const exportTeamWorkloadCsv = () => {
    const rows = [
      ["Team Member", "Open Tasks"],
      ...data.teamWorkload.map((item) => [item.name, item.openTasks]),
    ];
    downloadCsv("team_workload", rows);
  };

  const exportProjectProgressCsv = () => {
    const rows = [
      ["Project Name", "Status", "Progress %", "Completed Tasks", "Total Tasks"],
      ...data.projectProgress.map((item) => [
        item.name,
        item.status,
        `${item.progressPercent}%`,
        item.completedTasks,
        item.totalTasks,
      ]),
    ];
    downloadCsv("project_progress_comparison", rows);
  };

  const exportOnTimeCompletionCsv = () => {
    const rows = [
      ["Metric", "Value"],
      ["On-Time Completion Rate", `${data.onTimeCompletion.rate}%`],
      ["On-Time Completed Tasks", data.onTimeCompletion.onTimeCount],
      ["Total Completed Tasks with Due Date", data.onTimeCompletion.totalCompletedWithDueDate],
    ];
    downloadCsv("on_time_completion_rate", rows);
  };

  const exportPpcTrendCsv = () => {
    const rows = [
      ["Week Starting", "PPC (%)", "Tasks Due", "Tasks Completed On-Time"],
      ...data.ppcTrend.map((item) => [item.weekLabel, `${item.ppc}%`, item.dueCount, item.completedOnTimeCount]),
    ];
    downloadCsv("ppc_last_planner_system", rows);
  };

  const exportResourceUtilizationCsv = () => {
    const rows = [
      ["Resource State", "Quantity"],
      ["In-Use (Active)", data.resourceUtilization.inUseCount],
      ["Approved (Idle)", data.resourceUtilization.idleApprovedCount],
      ["Requested (Pending)", data.resourceUtilization.requestedCount],
      ["Total Active Allocations", data.resourceUtilization.totalActiveCount],
      ["Utilization Rate", `${data.resourceUtilization.utilizationPct}%`],
    ];
    downloadCsv("resource_utilization", rows);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* Print stylesheet lives in app/globals.css as a plain @media print
          block — a <style jsx> tag here would silently do nothing, since
          styled-jsx requires an explicit StyledJsxRegistry in the App Router
          (see Next.js CSS-in-JS docs) that this project doesn't set up. */}

      {/* Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-5 no-print">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Reports & Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time project progress, task throughput, and team workload.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintPdf}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-secondary text-foreground transition-all shadow-sm"
          >
            <Printer className="w-4 h-4 text-muted-foreground" />
            Export Summary as PDF
          </button>
        </div>
      </div>

      {/* Filter Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm no-print">
        <div className="flex flex-wrap items-center gap-4">
          {/* Date Range Selector */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-foreground">Time Horizon:</span>
            <div className="flex bg-secondary p-1 rounded-lg border border-border">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onDateRangeChange(opt.value)}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-all",
                    dateRange === opt.value
                      ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Project Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs font-semibold text-foreground">Project:</span>
            <select
              value={selectedProject}
              onChange={(e) => onProjectChange(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Projects ({data.projectsList.length})</option>
              {data.projectsList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Updating charts…
          </div>
        )}
      </div>

      {/* Print Header (Only visible in PDF export print output) */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold">Nirmaan ERP — Executive Performance Report</h1>
        <p className="text-sm text-gray-600">
          Generated on {new Date().toLocaleDateString("en-IN", { dateStyle: "long" })} | Time Horizon: {DATE_RANGE_OPTIONS.find(d => d.value === dateRange)?.label}
        </p>
      </div>

      {/* ── 2x2 Grid of Report Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 reports-grid">
        {/* Card 1: Project Status Breakdown */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center">
                <PieIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Project Status Breakdown</h3>
                <p className="text-xs text-muted-foreground">Distribution of active and planned projects</p>
              </div>
            </div>
            <button
              onClick={exportProjectStatusCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="flex-1 flex flex-col justify-between">
            <div className="h-52 w-full flex items-center justify-center">
              {data.projectStatus.every((s) => s.count === 0) ? (
                <p className="text-xs text-muted-foreground">No projects found for selected filters.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.projectStatus.filter((s) => s.count > 0)}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {data.projectStatus
                        .filter((s) => s.count > 0)
                        .map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any, name: any) => [`${val} Projects`, name]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Clean Custom Legend */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3 border-t border-border">
              {data.projectStatus.map((item) => (
                <div key={item.status} className="flex items-center gap-1.5 text-xs">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className="font-semibold text-foreground">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 2: Task Completion Trend */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Task Completion Trend</h3>
                <p className="text-xs text-muted-foreground">{data.trendSubtitle}</p>
              </div>
            </div>
            <button
              onClick={exportCompletionTrendCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.completionTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="weekLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "12px",
                    color: "hsl(var(--foreground))",
                  }}
                />
                <Bar dataKey="completed" name="Tasks Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Team Workload */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center">
                <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Team Workload</h3>
                <p className="text-xs text-muted-foreground">Open tasks assigned per team member</p>
              </div>
            </div>
            <button
              onClick={exportTeamWorkloadCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="h-64 w-full">
            {data.teamWorkload.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No open tasks assigned.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data.teamWorkload}
                  margin={{ top: 10, right: 20, left: 20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="openTasks" name="Open Tasks" fill="#4f46e5" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Card 4: Project Progress Comparison */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Project Progress Comparison</h3>
                <p className="text-xs text-muted-foreground">% complete per active project</p>
              </div>
            </div>
            <button
              onClick={exportProjectProgressCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="h-64 w-full">
            {data.projectProgress.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No active projects found.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.projectProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(val: any) => [`${val}%`, "Completion Rate"]}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="progressPercent" name="% Complete" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Card 5: On-Time Completion Rate */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">On-Time Completion Rate</h3>
                <p className="text-xs text-muted-foreground">Tasks finished before or on their due date</p>
              </div>
            </div>
            <button
              onClick={exportOnTimeCompletionCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-4">
            {data.onTimeCompletion.totalCompletedWithDueDate === 0 ? (
              <p className="text-xs text-muted-foreground">No completed tasks with due dates in range.</p>
            ) : (
              <>
                <div className="relative flex items-center justify-center">
                  <svg viewBox="0 0 120 120" className="w-36 h-36 -rotate-90">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
                    <circle
                      cx="60" cy="60" r="50" fill="none"
                      stroke={data.onTimeCompletion.rate >= 70 ? "#10b981" : data.onTimeCompletion.rate >= 40 ? "#f59e0b" : "#f43f5e"}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(data.onTimeCompletion.rate / 100) * 314} 314`}
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-bold text-foreground">{data.onTimeCompletion.rate}%</span>
                    <span className="text-[10px] text-muted-foreground leading-tight">on time</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>
                    <span className="font-semibold text-foreground">{data.onTimeCompletion.onTimeCount}</span> on-time
                  </span>
                  <span className="text-border">·</span>
                  <span>
                    <span className="font-semibold text-foreground">{data.onTimeCompletion.totalCompletedWithDueDate}</span> total with due date
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 6: Percent Plan Complete (PPC) — Last Planner System */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-950/60 flex items-center justify-center">
                <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Percent Plan Complete</h3>
                <p className="text-xs text-muted-foreground">PPC (Last Planner System) — weekly reliability %</p>
              </div>
            </div>
            <button
              onClick={exportPpcTrendCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="h-64 w-full">
            {data.ppcTrend.every((w) => w.dueCount === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No tasks with due dates in selected range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.ppcTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="weekLabel" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(val: any, name: any) => [`${val}%`, name]}
                    labelFormatter={(label) => `Week of ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: "12px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="ppc"
                    name="PPC %"
                    stroke="#8b5cf6"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: "#8b5cf6", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Card 7: Resource Utilization */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card lg:col-span-2">
          <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center">
                <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Resource Utilization</h3>
                <p className="text-xs text-muted-foreground">In-use vs idle approved vs pending requested allocations</p>
              </div>
            </div>
            <button
              onClick={exportResourceUtilizationCsv}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
              title="Export CSV"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            {data.resourceUtilization.totalActiveCount === 0 ? (
              <p className="text-xs text-muted-foreground">No active resource allocations found.</p>
            ) : (
              <>
                {/* Donut */}
                <div className="h-52 w-52 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "In-Use", value: data.resourceUtilization.inUseCount, color: "#4f46e5" },
                          { name: "Approved (Idle)", value: data.resourceUtilization.idleApprovedCount, color: "#a5b4fc" },
                          { name: "Requested", value: data.resourceUtilization.requestedCount, color: "#e2e8f0" },
                        ].filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={76}
                        paddingAngle={3}
                      >
                        {[
                          { name: "In-Use", value: data.resourceUtilization.inUseCount, color: "#4f46e5" },
                          { name: "Approved (Idle)", value: data.resourceUtilization.idleApprovedCount, color: "#a5b4fc" },
                          { name: "Requested", value: data.resourceUtilization.requestedCount, color: "#e2e8f0" },
                        ]
                          .filter((d) => d.value > 0)
                          .map((entry, index) => (
                            <Cell key={`cell-util-${index}`} fill={entry.color} />
                          ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [val, name]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "0.5rem",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Stats panel */}
                <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-4xl font-bold text-foreground">{data.resourceUtilization.utilizationPct}%</p>
                    <p className="text-xs text-muted-foreground mt-1">utilization rate</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: "In-Use (Active)", value: data.resourceUtilization.inUseCount, color: "#4f46e5" },
                      { label: "Approved (Idle)", value: data.resourceUtilization.idleApprovedCount, color: "#a5b4fc" },
                      { label: "Requested", value: data.resourceUtilization.requestedCount, color: "#e2e8f0" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-2 text-xs">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.label}:</span>
                        <span className="font-semibold text-foreground">{item.value}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/50">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-transparent" />
                      <span className="text-muted-foreground">Total Active:</span>
                      <span className="font-semibold text-foreground">{data.resourceUtilization.totalActiveCount}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 8: Cost Variance & Budget Performance (Lean Construction Financial Metric) */}
        {budgetAnalytics && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card lg:col-span-2">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center">
                  <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Cost Variance & Financial Performance</h3>
                  <p className="text-xs text-muted-foreground">
                    Per-project budget variance (Allocated Cap − Actual Approved Spend) — Lean Construction financial metric
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-foreground">
                    Overall Utilization: <span className="text-indigo-600 dark:text-indigo-400">{budgetAnalytics.overallUtilizationPercent}%</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    ₹{budgetAnalytics.totalApprovedExpenses.toLocaleString("en-IN")} / ₹{budgetAnalytics.totalAllocatedBudget.toLocaleString("en-IN")}
                  </p>
                </div>

                <button
                  onClick={() => {
                    const rows = [
                      ["Project Name", "Budget Allocated", "Approved Spend", "Cost Variance", "Variance %", "Status"],
                      ...budgetAnalytics.projectCostVariances.map((v: any) => [
                        v.projectName,
                        v.budgetAllocated,
                        v.approvedSpend,
                        v.variance,
                        `${v.variancePercent}%`,
                        v.variance >= 0 ? "Under Budget" : "Over Budget",
                      ]),
                    ];
                    downloadCsv("cost_variance_financial_performance", rows);
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors no-print"
                  title="Export CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  CSV
                </button>
              </div>
            </div>

            <div className="h-64 w-full">
              {budgetAnalytics.projectCostVariances.length === 0 ? (
                <div className="text-center py-10 text-xs text-muted-foreground">
                  No project budget allocations found.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={budgetAnalytics.projectCostVariances}
                    margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="projectName" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={10}
                      tickLine={false}
                      tickFormatter={(val) => `₹${(val / 100000).toFixed(0)}L`}
                    />
                    <Tooltip
                      formatter={(val: any, name: any) => [
                        `₹${Number(val).toLocaleString("en-IN")}`,
                        name === "variance" ? "Cost Variance (Savings / Deficit)" : name,
                      ]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "0.5rem",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="variance" name="Cost Variance (Cap - Spend)" radius={[4, 4, 0, 0]}>
                      {budgetAnalytics.projectCostVariances.map((entry: any, index: number) => (
                        <Cell key={`cell-var-${index}`} fill={entry.variance >= 0 ? "#10b981" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 pt-3 border-t border-border text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                <span className="text-muted-foreground font-medium">Positive Variance: Under Budget (Savings)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                <span className="text-muted-foreground font-medium">Negative Variance: Over Budget (Deficit)</span>
              </div>
            </div>
          </div>
        )}

        {/* Card 9: Quality Control & Open Punch Items */}
        {data.punchListMetrics && (
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col report-card lg:col-span-2">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-rose-100 dark:bg-rose-950/60 flex items-center justify-center">
                  <Target className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Quality Control & Punch List Defect Summary</h3>
                  <p className="text-xs text-muted-foreground">Site quality snagging, open remediation items, and defect severity levels</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
              <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <p className="text-xs font-semibold text-muted-foreground">Total Logged Snags</p>
                <p className="text-3xl font-bold text-foreground mt-1">{data.punchListMetrics.totalCount}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Project QA Register</p>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900">
                <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">Open Defect Snags</p>
                <p className="text-3xl font-bold text-rose-600 dark:text-rose-400 mt-1">{data.punchListMetrics.openCount}</p>
                <p className="text-[11px] text-rose-700/80 dark:text-rose-300/80 mt-1">Awaiting Remediation</p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Major Severity Defects</p>
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400 mt-1">{data.punchListMetrics.majorCount}</p>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-1">High Priority Rework</p>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Resolved & Verified</p>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{data.punchListMetrics.resolvedCount}</p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 mt-1">Passed QA Inspection</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
