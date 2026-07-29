"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import {
  createTask,
  updateTaskStatus,
  type TaskWithProject,
  type TaskStatus,
} from "@/lib/queries/tasks";
import { KanbanColumn } from "./KanbanColumn";
import { TaskCard } from "./TaskCard";
import { AddTaskModal } from "./AddTaskModal";
import { Plus, Search } from "lucide-react";

interface KanbanBoardProps {
  initialTasks: TaskWithProject[];
  projects: { id: string; name: string }[];
  userId: string;
}

const COLUMNS: { id: TaskStatus; title: string; dot: string }[] = [
  { id: "todo", title: "To Do", dot: "bg-slate-400" },
  { id: "in_progress", title: "In Progress", dot: "bg-indigo-500" },
  { id: "review", title: "Review", dot: "bg-amber-500" },
  { id: "done", title: "Done", dot: "bg-emerald-500" },
];

export function KanbanBoard({ initialTasks, projects, userId }: KanbanBoardProps) {
  const router = useRouter();
  const supabase = createClient();

  const [tasks, setTasks] = useState<TaskWithProject[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskWithProject | null>(null);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const filteredTasks = tasks.filter(
    (t) =>
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      (t.project_name && t.project_name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id as string;
    let targetStatus: TaskStatus | null = null;

    // Check if over target is a column id directly
    if (COLUMNS.some((col) => col.id === over.id)) {
      targetStatus = over.id as TaskStatus;
    } else {
      // Over another task card -> find its status
      const overTask = tasks.find((t) => t.id === over.id);
      if (overTask) {
        targetStatus = overTask.status;
      }
    }

    if (!targetStatus) return;

    const currentTask = tasks.find((t) => t.id === taskId);
    if (!currentTask || currentTask.status === targetStatus) return;

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus! } : t))
    );

    // Persist to Supabase
    const { error } = await updateTaskStatus(supabase, taskId, targetStatus);
    if (error) {
      console.error("Failed to update task status:", error);
      setTasks(previousTasks); // Revert on error
    } else {
      router.refresh();
    }
  };

  const handleMarkDone = async (taskId: string) => {
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: "done" } : t))
    );

    const { error } = await updateTaskStatus(supabase, taskId, "done");
    if (error) {
      setTasks(previousTasks);
    } else {
      router.refresh();
    }
  };

  const handleAddTaskSubmit = async (formData: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: any;
    project_id: string;
    due_date: string;
  }) => {
    setIsSubmitting(true);
    try {
      const { data, error } = await createTask(supabase, {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        project_id: formData.project_id || undefined,
        assignee_id: userId,
        due_date: formData.due_date || undefined,
      });

      if (error) throw error;
      if (data) {
        setTasks((prev) => [data, ...prev]);
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search my tasks by title, project..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-card border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* 4-Column Drag & Drop Board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              id={column.id}
              title={column.title}
              dotColor={column.dot}
              tasks={filteredTasks.filter((t) => t.status === column.id)}
              onMarkDone={handleMarkDone}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} /> : null}
        </DragOverlay>
      </DndContext>

      {/* Add Task Modal */}
      <AddTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddTaskSubmit}
        projects={projects}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
