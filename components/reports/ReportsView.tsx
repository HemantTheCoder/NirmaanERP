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
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
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
import { cn } from "@/lib/utils";

interface ReportsViewProps {
  initialData: ReportsAggregateData;
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

export function ReportsView({ initialData }: ReportsViewProps) {
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

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* ── Print Stylesheet ────────────────────────────────────────────────── */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }
          header, sidebar, nav, button, .no-print {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          .reports-grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
            page-break-inside: avoid;
          }
          .report-card {
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            break-inside: avoid;
          }
        }
      `}</style>

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
      </div>
    </div>
  );
}
