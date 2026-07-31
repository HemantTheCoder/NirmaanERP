"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  UserCheck,
  CheckCircle2,
  ListTodo,
  GanttChart,
  FileText,
  Package,
  Folder,
} from "lucide-react";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { ProjectResourcesView } from "@/components/projects/ProjectResourcesView";
import { ProjectDocumentsView } from "@/components/projects/ProjectDocumentsView";
import { TaskDetailModal } from "@/components/projects/TaskDetailModal";
import type { ResourceAllocationItem } from "@/lib/queries/resources";
import type { ProjectDocumentItem } from "@/lib/queries/documents";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProjectDetailViewProps {
  project: {
    id: string;
    name: string;
    description: string | null;
    status: "planning" | "active" | "on_hold" | "completed";
    start_date: string | null;
    end_date: string | null;
    manager_name: string | null;
  };
  initialTasks: any[];
  initialResources: ResourceAllocationItem[];
  initialDocuments: ProjectDocumentItem[];
  userId: string;
  userRole: UserRole;
}

export function ProjectDetailView({
  project,
  initialTasks,
  initialResources,
  initialDocuments,
  userId,
  userRole,
}: ProjectDetailViewProps) {
  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<"tasks" | "timeline" | "resources" | "documents">("tasks");

  // Modal State
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleTaskUpdate = (updatedTask: any) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Back button & Breadcrumb */}
      <div>
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Projects
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{project.name}</h2>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground text-sm max-w-2xl">
              {project.description || "No description provided."}
            </p>
          </div>
        </div>
      </div>

      {/* Meta Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Project Manager</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {project.manager_name || "Unassigned"}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Schedule Period</p>
            <p className="text-sm font-semibold text-foreground mt-0.5">
              {project.start_date || "N/A"} → {project.end_date || "N/A"}
            </p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Tasks Progress</p>
              <span className="text-xs font-bold text-foreground">{progressPct}%</span>
            </div>
            <div className="h-2 bg-secondary rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tab Switcher & Content Wrapper */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("tasks")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "tasks"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTodo className="w-3.5 h-3.5 text-primary" />
              Tasks List ({totalTasks})
            </button>

            <button
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "timeline"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <GanttChart className="w-3.5 h-3.5 text-indigo-600" />
              Timeline (Gantt)
            </button>

            <button
              onClick={() => setActiveTab("resources")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "resources"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Package className="w-3.5 h-3.5 text-amber-500" />
              Resources ({initialResources.length})
            </button>

            <button
              onClick={() => setActiveTab("documents")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "documents"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Folder className="w-3.5 h-3.5 text-indigo-500" />
              Documents ({initialDocuments.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Tasks List */}
        {activeTab === "tasks" && (
          <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-sm">
            {tasks.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-lg">
                <FileText className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-foreground">No tasks assigned to this project yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Add tasks from My Workspace or assign work packages.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {tasks.map((task: any) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/40 transition-colors px-3 rounded-lg cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors">
                        {task.title}
                      </p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Assignee: {task.assignee_name || "Unassigned"}</span>
                        {task.start_date && <span>Start: {task.start_date}</span>}
                        {task.due_date && <span>Due: {task.due_date}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium uppercase ${
                          task.priority === "urgent"
                            ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400"
                            : task.priority === "high"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {task.priority}
                      </span>

                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                          task.status === "done"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400"
                            : task.status === "in_progress"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400"
                            : task.status === "review"
                            ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {task.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Timeline (Gantt Chart) */}
        {activeTab === "timeline" && (
          <ProjectGanttChart
            tasks={tasks}
            onTaskClick={(task) => setSelectedTask(task)}
          />
        )}

        {/* Tab 3: Resources */}
        {activeTab === "resources" && (
          <ProjectResourcesView
            initialResources={initialResources}
            projectId={project.id}
            userId={userId}
            userRole={userRole}
          />
        )}

        {/* Tab 4: Documents */}
        {activeTab === "documents" && (
          <ProjectDocumentsView
            initialDocuments={initialDocuments}
            projectId={project.id}
            userId={userId}
            userRole={userRole}
          />
        )}
      </div>

      {/* Task Edit Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdateSuccess={handleTaskUpdate}
      />
    </div>
  );
}
