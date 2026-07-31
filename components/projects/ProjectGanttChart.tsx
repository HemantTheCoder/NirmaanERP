"use client";

import { useState, useMemo } from "react";
import { Check, AlertCircle, Calendar, User, Clock, FileText } from "lucide-react";
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
  tasks: GanttTask[];
  onTaskClick?: (task: GanttTask) => void;
}

const DAY_WIDTH_PX = 44; // width per day in grid

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  done:        { bg: "bg-emerald-500 dark:bg-emerald-600", border: "border-emerald-600", text: "text-white" },
  in_progress: { bg: "bg-indigo-600 dark:bg-indigo-500", border: "border-indigo-700", text: "text-white" },
  review:      { bg: "bg-amber-500 dark:bg-amber-600",   border: "border-amber-600",  text: "text-white" },
  todo:        { bg: "bg-slate-400 dark:bg-slate-500",   border: "border-slate-500",  text: "text-white" },
};

export function ProjectGanttChart({ tasks, onTaskClick }: ProjectGanttChartProps) {
  const [hoveredTask, setHoveredTask] = useState<GanttTask | null>(null);

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

  // ── 2. Helper Functions for Bar Positioning ─────────────────────────────────

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
    return diff > 0 ? diff : 1; // 1-day minimum fallback when due_date is null
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

  const timelineWidthPx = totalDays * DAY_WIDTH_PX;

  return (
    <div className="space-y-4">
      {/* Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-secondary/40 rounded-xl border border-border text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-foreground">Status Legend:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
            <span className="text-muted-foreground">Done</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-indigo-600 inline-block" />
            <span className="text-muted-foreground">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span className="text-muted-foreground">Review</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-slate-400 inline-block" />
            <span className="text-muted-foreground">To Do</span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-muted-foreground">
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
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm relative">
        <div className="overflow-x-auto">
          <div style={{ minWidth: `${320 + timelineWidthPx}px` }}>
            {/* Header Rows */}
            <div className="flex border-b border-border bg-secondary/60">
              {/* Sticky Task Header Column */}
              <div className="w-80 shrink-0 sticky left-0 z-30 bg-card border-r border-border px-4 py-3 font-semibold text-xs text-foreground flex items-center justify-between shadow-xs">
                <span>Task Name</span>
                <span className="text-muted-foreground font-normal text-[11px]">Assignee</span>
              </div>

              {/* Date Header Timeline Columns */}
              <div className="flex-1 flex flex-col">
                {/* Week Row */}
                <div className="flex border-b border-border/60">
                  {weekHeaders.map((w, i) => (
                    <div
                      key={i}
                      style={{ width: `${w.colSpan * DAY_WIDTH_PX}px` }}
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
                        style={{ width: `${DAY_WIDTH_PX}px` }}
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
                    left: `${320 + todayIndex * DAY_WIDTH_PX + DAY_WIDTH_PX / 2}px`,
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

                const leftPx = startOffsetDays * DAY_WIDTH_PX;
                const barWidthPx = Math.max(durationDays * DAY_WIDTH_PX - 6, 28); // padding

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
                          className="text-xs font-semibold text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                        >
                          {task.title}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {taskStartStr} → {taskDueStr}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center"
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
                            style={{ width: `${DAY_WIDTH_PX}px` }}
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
                          left: `${leftPx + 3}px`,
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
                          <span className="truncate text-[11px] font-medium">
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
