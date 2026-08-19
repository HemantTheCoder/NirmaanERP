"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  IndianRupee,
  AlertOctagon,
  FileCheck2,
  Plus,
} from "lucide-react";
import { StatusBadge } from "@/components/projects/StatusBadge";
import { ProjectGanttChart } from "@/components/projects/ProjectGanttChart";
import { ProjectResourcesView } from "@/components/projects/ProjectResourcesView";
import { ProjectDocumentsView } from "@/components/projects/ProjectDocumentsView";
import { ProjectBudgetView } from "@/components/projects/ProjectBudgetView";
import { PunchListView } from "@/components/projects/PunchListView";
import { DailyProgressReportView } from "@/components/projects/DailyProgressReportView";
import { TaskDetailModal } from "@/components/projects/TaskDetailModal";
import { CreateTaskModal } from "@/components/projects/CreateTaskModal";
import type { ResourceAllocationItem } from "@/lib/queries/resources";
import type { ProjectDocumentItem } from "@/lib/queries/documents";
import type { ProjectBudgetSummary } from "@/lib/queries/finance";
import type { PunchItem } from "@/lib/queries/punch_list";
import type { DailyProgressReport } from "@/lib/queries/dpr";
import type { ProjectDelay } from "@/lib/queries/delays";
import { DelayStatusPanel } from "@/components/projects/DelayStatusPanel";
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
  initialBudgetSummary: ProjectBudgetSummary;
  initialPunchItems: PunchItem[];
  initialTodayDpr: DailyProgressReport | null;
  initialDprHistory: DailyProgressReport[];
  initialOpenDelay: ProjectDelay | null;
  initialDelayHistory: ProjectDelay[];
  teamMembers?: any[];
  userId: string;
  userRole: UserRole;
}

export function ProjectDetailView({
  project,
  initialTasks,
  initialResources,
  initialDocuments,
  initialBudgetSummary,
  initialPunchItems,
  initialTodayDpr,
  initialDprHistory,
  initialOpenDelay,
  initialDelayHistory,
  teamMembers = [],
  userId,
  userRole,
}: ProjectDetailViewProps) {
  const router = useRouter();

  const [tasks, setTasks] = useState<any[]>(initialTasks);
  const [activeTab, setActiveTab] = useState<"tasks" | "timeline" | "resources" | "documents" | "budget" | "punch_list" | "dpr">("tasks");

  // Modal State
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleTaskUpdate = (updatedTask: any) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === updatedTask.id ? { ...t, ...updatedTask } : t))
    );
    router.refresh();
  };

  const handleTaskCreated = (newTask: any) => {
    setTasks((prev) => [newTask, ...prev]);
    router.refresh();
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

          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs shadow-md transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Task
          </button>
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

      {/* Delay status — surfaced at project level, not buried in a tab */}
      <DelayStatusPanel
        projectId={project.id}
        initialOpenDelay={initialOpenDelay}
        initialHistory={initialDelayHistory}
        user={{ id: userId, role: userRole }}
      />

      {/* Tab Switcher & Content Wrapper */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex flex-wrap bg-secondary/80 p-1 rounded-xl border border-border gap-1">
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

            <button
              onClick={() => setActiveTab("budget")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "budget"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <IndianRupee className="w-3.5 h-3.5 text-emerald-600" />
              Budget & Expenses
            </button>

            <button
              onClick={() => setActiveTab("punch_list")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "punch_list"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
              Punch List ({initialPunchItems.length})
            </button>

            <button
              onClick={() => setActiveTab("dpr")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "dpr"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileCheck2 className="w-3.5 h-3.5 text-indigo-600" />
              Daily Report ({initialDprHistory.length})
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
                  Click &quot;Add Task&quot; above to create the first work package.
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
            projectName={project.name}
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

        {/* Tab 5: Budget & Expenses */}
        {activeTab === "budget" && (
          <ProjectBudgetView
            projectId={project.id}
            initialSummary={initialBudgetSummary}
            user={{ id: userId, role: userRole }}
          />
        )}

        {/* Tab 6: Punch List */}
        {activeTab === "punch_list" && (
          <PunchListView
            projectId={project.id}
            initialItems={initialPunchItems}
            user={{ id: userId, role: userRole }}
            teamMembers={teamMembers}
          />
        )}

        {/* Tab 7: Daily Report */}
        {activeTab === "dpr" && (
          <DailyProgressReportView
            projectId={project.id}
            initialHistory={initialDprHistory}
            initialTodayReport={initialTodayDpr}
            user={{ id: userId, role: userRole }}
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

      {/* Create Task Modal */}
      <CreateTaskModal
        projectId={project.id}
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        onTaskCreated={handleTaskCreated}
        teamMembers={teamMembers}
      />
    </div>
  );
}
