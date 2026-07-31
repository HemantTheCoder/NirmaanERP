"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { TaskWithProject, TaskStatus } from "@/lib/queries/tasks";
import { TaskCard } from "./TaskCard";
import { cn } from "@/lib/utils";

interface KanbanColumnProps {
  id: TaskStatus;
  title: string;
  tasks: TaskWithProject[];
  dotColor: string;
  onMarkDone?: (taskId: string) => Promise<void>;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  dotColor,
  onMarkDone,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col bg-muted/40 border border-border rounded-xl p-4 min-h-[500px] transition-colors",
        isOver && "bg-indigo-50/50 dark:bg-indigo-950/20 border-primary/50"
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", dotColor)} />
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-card border border-border text-xs font-bold text-muted-foreground">
          {tasks.length}
        </span>
      </div>

      {/* Column Task Cards */}
      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onMarkDone={onMarkDone} />
          ))}

          {tasks.length === 0 && (
            <div className="h-32 border border-dashed border-border rounded-lg flex items-center justify-center text-xs text-muted-foreground">
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
