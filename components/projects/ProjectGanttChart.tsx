"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import {
  Check,
  AlertCircle,
  Calendar,
  User,
  Clock,
  FileText,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  FileImage,
  Printer,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GanttTask {
  id: string;
  title: string;
  description?: string | null;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  start_date?: string | null;
  due_date?: string | null;
  created_at: string;
  assignee_name?: string | null;
}

interface ProjectGanttChartProps {
  projectName?: string;
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string; hex: string }> = {
  done:        { bg: "bg-emerald-500 dark:bg-emerald-600", border: "border-emerald-600", text: "text-white", hex: "#10b981" },
  in_progress: { bg: "bg-indigo-600 dark:bg-indigo-500", border: "border-indigo-700", text: "text-white", hex: "#4f46e5" },
  review:      { bg: "bg-amber-500 dark:bg-amber-600",   border: "border-amber-600",  text: "text-white", hex: "#f59e0b" },
  todo:        { bg: "bg-slate-400 dark:bg-slate-500",   border: "border-slate-500",  text: "text-white", hex: "#94a3b8" },
};

export function ProjectGanttChart({
  projectName = "Project Timeline",
  tasks,
  onTaskClick,
}: ProjectGanttChartProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  const [hoveredTask, setHoveredTask] = useState<GanttTask | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month" | "fit">("day");
  const [dayWidth, setDayWidth] = useState<number>(44);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ── 1. Calculate Date Bounds & Daily Grid ───────────────────────────────────

  const { days, startDate, totalDays, todayIndex } = useMemo(() => {
    if (tasks.length === 0) {
      return { days: [], startDate: new Date(), totalDays: 0, todayIndex: -1 };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    tasks.forEach((t) => {
      const s = new Date(t.start_date || t.created_at.slice(0, 10)).getTime();
      const d = new Date(t.due_date || t.start_date || t.created_at.slice(0, 10)).getTime();

      if (!isNaN(s)) minTime = Math.min(minTime, s);
      if (!isNaN(d)) maxTime = Math.max(maxTime, d);
    });

    const todayTime = new Date().getTime();
    minTime = Math.min(minTime, todayTime);
    maxTime = Math.max(maxTime, todayTime);

    // Padding: 3 days before min, 7 days after max
    const start = new Date(minTime);
    start.setDate(start.getDate() - 3);

    const end = new Date(maxTime);
    end.setDate(end.getDate() + 7);

    const dayList: Date[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      dayList.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const tIdx = dayList.findIndex(
      (d) => d.toISOString().slice(0, 10) === todayStr
    );

    return {
      days: dayList,
      startDate: start,
      totalDays: dayList.length,
      todayIndex: tIdx,
    };
  }, [tasks, todayStr]);

  // Group days into week headers
  const weekHeaders = useMemo(() => {
    const weeks: { label: string; colSpan: number }[] = [];
    let currentWeekLabel = "";
    let count = 0;

    days.forEach((d) => {
      const weekNum = getWeekNumber(d);
      const label = `Week ${weekNum} (${d.toLocaleDateString("en-IN", { month: "short" })})`;

      if (label !== currentWeekLabel) {
        if (count > 0) {
          weeks.push({ label: currentWeekLabel, colSpan: count });
        }
        currentWeekLabel = label;
        count = 1;
      } else {
        count++;
      }
    });

    if (count > 0) {
      weeks.push({ label: currentWeekLabel, colSpan: count });
    }

    return weeks;
  }, [days]);

  // Handle Zoom Mode Changes
  const handleSetViewMode = (mode: "day" | "week" | "month" | "fit") => {
    setViewMode(mode);
    if (mode === "day") {
      setDayWidth(44);
    } else if (mode === "week") {
      setDayWidth(22);
    } else if (mode === "month") {
      setDayWidth(10);
    } else if (mode === "fit") {
      calculateFitToView();
    }
  };

  const calculateFitToView = () => {
    if (!containerRef.current || totalDays === 0) return;
    const containerWidth = containerRef.current.clientWidth;
    const availableWidth = containerWidth - 320; // Subtract sticky task column width
    const calculatedWidth = Math.max(6, Math.floor(availableWidth / totalDays));
    setDayWidth(calculatedWidth);
  };

  const handleZoomIn = () => {
    setViewMode("day");
    setDayWidth((prev) => Math.min(120, Math.round(prev * 1.25)));
  };

  const handleZoomOut = () => {
    setDayWidth((prev) => Math.max(6, Math.round(prev * 0.8)));
  };

  // ── Helper Functions for Bar Positioning ─────────────────────────────────

  const getDayOffset = (dateStr: string) => {
    const d = new Date(dateStr);
    const diff = Math.round(
      (d.getTime() - startDate.getTime()) / (1000 * 3600 * 24)
    );
    return Math.max(0, diff);
  };

  const getTaskDurationDays = (startStr: string, dueStr?: string | null) => {
    const s = new Date(startStr);
    const d = dueStr ? new Date(dueStr) : s;
    const diff = Math.ceil((d.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  // ── Export Functions ────────────────────────────────────────────────────────

  const handleExportPng = () => {
    setIsExportMenuOpen(false);

    // Create an offscreen HTML5 canvas to render the full Gantt chart
    const canvas = document.createElement("canvas");
    const taskColWidth = 300;
    const chartGridWidth = totalDays * Math.max(12, dayWidth);
    const width = taskColWidth + chartGridWidth;
    const headerHeight = 70;
    const rowHeight = 44;
    const height = headerHeight + tasks.length * rowHeight + 40;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#0f172a"; // Slate-900 dark background
    ctx.fillRect(0, 0, width, height);

    // Header Banner
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(0, 0, width, headerHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText(`Nirmaan ERP — ${projectName} Gantt Timeline`, 16, 28);

    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(
      `Generated on ${new Date().toLocaleDateString("en-IN")} • Total Tasks: ${tasks.length} • Total Days: ${totalDays}`,
      16,
      50
    );

    // Task Header
    ctx.fillStyle = "#334155";
    ctx.fillRect(0, headerHeight, taskColWidth, rowHeight);
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("Task Name", 16, headerHeight + 26);

    // Draw Date Headers
    days.forEach((d, i) => {
      const x = taskColWidth + i * Math.max(12, dayWidth);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, headerHeight, Math.max(12, dayWidth), rowHeight);

      if (dayWidth >= 16) {
        ctx.fillStyle = i === todayIndex ? "#f43f5e" : "#94a3b8";
        ctx.font = "10px sans-serif";
        ctx.fillText(d.getDate().toString(), x + 4, headerHeight + 26);
      }
    });

    // Draw Task Rows & Bars
    tasks.forEach((task, idx) => {
      const y = headerHeight + rowHeight + idx * rowHeight;

      // Row background
      ctx.fillStyle = idx % 2 === 0 ? "#0f172a" : "#1e293b";
      ctx.fillRect(0, y, width, rowHeight);

      // Border line
      ctx.strokeStyle = "#334155";
      ctx.beginPath();
      ctx.moveTo(0, y + rowHeight);
      ctx.lineTo(width, y + rowHeight);
      ctx.stroke();

      // Task label
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 12px sans-serif";
      const titleTrunc = task.title.length > 32 ? task.title.slice(0, 30) + "…" : task.title;
      ctx.fillText(titleTrunc, 16, y + 26);

      // Task Bar
      const taskStartStr = task.start_date || task.created_at.slice(0, 10);
      const startOffset = getDayOffset(taskStartStr);
      const duration = getTaskDurationDays(taskStartStr, task.due_date);

      const barX = taskColWidth + startOffset * Math.max(12, dayWidth);
      const barW = Math.max(duration * Math.max(12, dayWidth) - 4, 16);
      const colors = STATUS_COLORS[task.status] || STATUS_COLORS.todo;

      ctx.fillStyle = colors.hex;
      ctx.roundRect(barX, y + 10, barW, 24, 6);
      ctx.fill();

      // Bar Label inside
      if (barW > 40) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "10px sans-serif";
        ctx.fillText(task.title.slice(0, Math.floor(barW / 7)), barX + 6, y + 26);
      }
    });

    // Download PNG
    const link = document.createElement("a");
    link.download = `gantt_timeline_${projectName.toLowerCase().replace(/[^a-z0-9]/g, "_")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleExportPdf = () => {
    setIsExportMenuOpen(false);
    window.print();
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-card">
        <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm font-semibold text-foreground">No tasks in this timeline</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add tasks with start and due dates to view the interactive Gantt chart.
        </p>
      </div>
    );
  }

  const timelineWidthPx = totalDays * dayWidth;

  return (
    <div className="space-y-4" ref={containerRef}>
      {/* Print Styles for PDF Export */}
      <style>{`
        @media print {
          header, sidebar, nav, button, .no-print {
            display: none !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .gantt-print-container {
            overflow: visible !important;
            width: 100% !important;
          }
        }
      `}</style>

      {/* Gantt Controls Bar (Zoom, Fit to View & Export) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-secondary/50 rounded-2xl border border-border no-print">
        {/* Left: View Mode Pills & Zoom Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-foreground mr-1">Timeline Scale:</span>

          <div className="flex items-center gap-1 bg-background p-1 rounded-xl border border-border text-xs font-semibold">
            <button
              onClick={() => handleSetViewMode("day")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                viewMode === "day" ? "bg-primary text-primary-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Day View
            </button>
            <button
              onClick={() => handleSetViewMode("week")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                viewMode === "week" ? "bg-primary text-primary-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Week View
            </button>
            <button
              onClick={() => handleSetViewMode("month")}
              className={cn(
                "px-3 py-1 rounded-lg transition-all",
                viewMode === "month" ? "bg-primary text-primary-foreground shadow-xs font-bold" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Month View
            </button>
          </div>

          <button
            onClick={() => handleSetViewMode("fit")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border transition-all shadow-xs",
              viewMode === "fit" ? "bg-indigo-600 text-white border-indigo-600" : "bg-card text-foreground border-border hover:bg-secondary"
            )}
            title="Reset scale to fit full project timeline in visible screen"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            Fit to View
          </button>

          <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-border">
            <button
              onClick={handleZoomIn}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right: Export Dropdown Button */}
        <div className="relative">
          <button
            onClick={() => setIsExportMenuOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-xs transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export Timeline
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {isExportMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-card border border-border rounded-xl shadow-2xl z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={handleExportPng}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary flex items-center gap-2"
              >
                <FileImage className="w-4 h-4 text-emerald-500" />
                Export as Image (PNG)
              </button>
              <button
                onClick={handleExportPdf}
                className="w-full text-left px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-secondary flex items-center gap-2 border-t border-border"
              >
                <Printer className="w-4 h-4 text-indigo-500" />
                Export as PDF Document
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-card rounded-2xl border border-border text-xs shadow-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-bold text-foreground">Status Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span className="text-muted-foreground font-medium">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
            <span className="text-muted-foreground font-medium">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span className="text-muted-foreground font-medium">Review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
            <span className="text-muted-foreground font-medium">To Do</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-muted-foreground font-medium">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded border-2 border-rose-500 bg-rose-100 dark:bg-rose-950 inline-block" />
            Overdue Warning
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block" />
            Today Marker
          </span>
        </div>
      </div>

      {/* Gantt Timeline Board Container */}
      <div
        ref={chartWrapperRef}
        className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm relative gantt-print-container"
      >
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${320 + timelineWidthPx}px` }}>
            {/* Header Rows */}
            <div className="flex border-b border-border bg-secondary/60">
              {/* Sticky Task Header Column */}
              <div className="w-80 shrink-0 sticky left-0 z-30 bg-card border-r border-border px-4 py-3 font-bold text-xs text-foreground flex items-center justify-between shadow-xs">
                <span>Task Name</span>
                <span className="text-muted-foreground font-semibold text-[11px]">Assignee</span>
              </div>

              {/* Date Header Timeline Columns */}
              <div className="flex-1 flex flex-col">
                {/* Week Row */}
                <div className="flex border-b border-border/60">
                  {weekHeaders.map((w, i) => (
                    <div
                      key={i}
                      style={{ width: `${w.colSpan * dayWidth}px` }}
                      className="px-2 py-1 text-[11px] font-bold text-muted-foreground text-center border-r border-border/40 truncate bg-secondary/30"
                    >
                      {w.label}
                    </div>
                  ))}
                </div>

                {/* Day Row */}
                <div className="flex">
                  {days.map((d, i) => {
                    const isToday = i === todayIndex;
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                    return (
                      <div
                        key={i}
                        style={{ width: `${dayWidth}px` }}
                        className={cn(
                          "py-1.5 text-center text-[10px] border-r border-border/30 shrink-0 font-medium",
                          isToday
                            ? "bg-rose-500 text-white font-bold"
                            : isWeekend
                            ? "bg-muted/40 text-muted-foreground"
                            : "text-muted-foreground"
                        )}
                      >
                        <div>{d.toLocaleDateString("en-IN", { weekday: "narrow" })}</div>
                        <div>{d.getDate()}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Task Rows Body */}
            <div className="relative divide-y divide-border/60">
              {/* Vertical Today Marker Line across chart */}
              {todayIndex >= 0 && (
                <div
                  className="absolute top-0 bottom-0 z-20 pointer-events-none border-l-2 border-rose-500"
                  style={{
                    left: `${320 + todayIndex * dayWidth + dayWidth / 2}px`,
                  }}
                >
                  <div className="w-2 h-2 rounded-full bg-rose-500 -ml-1 -mt-1" />
                </div>
              )}

              {tasks.map((task) => {
                const taskStartStr = task.start_date || task.created_at.slice(0, 10);
                const taskDueStr = task.due_date || taskStartStr;

                const startOffsetDays = getDayOffset(taskStartStr);
                const durationDays = getTaskDurationDays(taskStartStr, task.due_date);

                const leftPx = startOffsetDays * dayWidth;
                const barWidthPx = Math.max(durationDays * dayWidth - 4, 16);

                const isOverdue =
                  task.due_date &&
                  task.due_date < todayStr &&
                  task.status !== "done";

                const isDone = task.status === "done";
                const colors = STATUS_COLORS[task.status] || STATUS_COLORS.todo;

                const assigneeInitials = (task.assignee_name || "Unassigned")
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase();

                return (
                  <div key={task.id} className="flex items-center h-14 hover:bg-muted/30 transition-colors relative group">
                    {/* Sticky Task Label Column */}
                    <div className="w-80 shrink-0 sticky left-0 z-30 bg-card border-r border-border px-4 py-2 flex items-center justify-between gap-2 shadow-xs h-full">
                      <div className="min-w-0 flex-1">
                        <p
                          onClick={() => onTaskClick?.(task)}
                          className="text-xs font-bold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        >
                          {task.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
                          {taskStartStr} → {taskDueStr}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shadow-xs"
                          title={task.assignee_name || "Unassigned"}
                        >
                          {assigneeInitials}
                        </div>
                      </div>
                    </div>

                    {/* Timeline Grid Cell Container */}
                    <div className="flex-1 relative h-full flex items-center">
                      {/* Grid Line Guides */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {days.map((_, i) => (
                          <div
                            key={i}
                            style={{ width: `${dayWidth}px` }}
                            className="border-r border-border/20 h-full shrink-0"
                          />
                        ))}
                      </div>

                      {/* Task Bar */}
                      <div
                        onClick={() => onTaskClick?.(task)}
                        onMouseEnter={() => setHoveredTask(task)}
                        onMouseLeave={() => setHoveredTask(null)}
                        style={{
                          left: `${leftPx + 2}px`,
                          width: `${barWidthPx}px`,
                        }}
                        className={cn(
                          "absolute h-7 rounded-lg flex items-center px-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer select-none",
                          colors.bg,
                          colors.text,
                          isOverdue && "border-2 border-rose-500 ring-2 ring-rose-500/20"
                        )}
                      >
                        <div className="flex items-center justify-between w-full truncate gap-1">
                          <span className="truncate text-[11px] font-semibold">
                            {task.title}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {isDone && <Check className="w-3.5 h-3.5 text-white" />}
                            {isOverdue && (
                              <span title="Overdue task">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-300 animate-pulse" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Hover Tooltip Popup */}
                        {hoveredTask?.id === task.id && (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-3 rounded-xl bg-slate-900 text-white shadow-2xl border border-slate-700 text-xs pointer-events-none space-y-1.5">
                            <p className="font-bold text-white text-xs">{task.title}</p>
                            {task.description && (
                              <p className="text-[11px] text-slate-300 line-clamp-2">{task.description}</p>
                            )}

                            <div className="pt-1.5 border-t border-slate-700/80 space-y-1 text-[11px] text-slate-300">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Assignee:</span>
                                <span className="font-semibold text-white">{task.assignee_name || "Unassigned"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Date Range:</span>
                                <span>{taskStartStr} → {taskDueStr}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Duration:</span>
                                <span>{durationDays} {durationDays === 1 ? "day" : "days"}</span>
                              </div>
                              <div className="flex justify-between capitalize">
                                <span className="text-slate-400">Status / Priority:</span>
                                <span>{task.status.replace("_", " ")} ({task.priority})</span>
                              </div>
                              {isOverdue && (
                                <p className="text-rose-400 font-bold text-[11px] pt-1">
                                  ⚠️ Overdue Task
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getWeekNumber(d: Date): number {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((date.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    )
  );
}
