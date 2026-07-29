"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskWithProject } from "@/lib/queries/tasks";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, GripVertical, Tag } from "lucide-react";

interface TaskCardProps {
  task: TaskWithProject;
  onMarkDone?: (taskId: string) => Promise<void>;
}

const priorityBadge: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  low: { label: "Low", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-400" },
  medium: { label: "Medium", bg: "bg-blue-50 dark:bg-blue-950/50", text: "text-blue-600 dark:text-blue-400" },
  high: { label: "High", bg: "bg-amber-50 dark:bg-amber-950/50", text: "text-amber-600 dark:text-amber-400" },
  urgent: { label: "Urgent", bg: "bg-rose-50 dark:bg-rose-950/50", text: "text-rose-600 dark:text-rose-400" },
};

export function TaskCard({ task, onMarkDone }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const priorityInfo = priorityBadge[task.priority] || priorityBadge.medium;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-card border border-border rounded-xl p-4 shadow-2xs hover:shadow-md transition-all duration-200",
        isDragging && "opacity-40 border-primary ring-2 ring-primary/20 z-50 scale-105"
      )}
    >
      {/* Top Bar: Drag Handle + Priority */}
      <div className="flex items-center justify-between mb-2">
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 rounded text-muted-foreground/50 hover:text-foreground transition-colors"
          title="Drag to move"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <span
          className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
            priorityInfo.bg,
            priorityInfo.text
          )}
        >
          {priorityInfo.label}
        </span>
      </div>

      {/* Task Title */}
      <h4 className="font-semibold text-foreground text-sm leading-snug group-hover:text-primary transition-colors">
        {task.title}
      </h4>

      {/* Description if present */}
      {task.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Metadata Chips */}
      <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between gap-2 text-xs">
        {/* Project Name Chip */}
        {task.project_name ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-md truncate max-w-[130px]">
            <Tag className="w-3 h-3 shrink-0" />
            <span className="truncate">{task.project_name}</span>
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">General</span>
        )}

        {/* Due Date or Mark Done */}
        <div className="flex items-center gap-2">
          {task.due_date && (
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {task.due_date}
            </span>
          )}

          {task.status !== "done" && onMarkDone && (
            <button
              type="button"
              onClick={() => onMarkDone(task.id)}
              title="Quick mark as done"
              className="p-1 text-muted-foreground hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
