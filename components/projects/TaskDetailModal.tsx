"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Loader2, Calendar, User, Clock, AlertTriangle, CheckCircle2, GitBranch, Plus, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { wouldCreateCycle } from "@/lib/utils/criticalPath";
import type { TaskDelayRisk } from "@/lib/utils/delayRisk";
import { addTaskDependency, removeTaskDependency, type TaskDependencyLink } from "@/lib/queries/taskDependencies";

interface TaskDetailModalProps {
  task: any | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateSuccess: (updatedTask: any) => void;
  /** Every task in the project, for the predecessor picker. */
  allTasks: any[];
  dependencies: TaskDependencyLink[];
  delayRisk?: TaskDelayRisk;
  userId: string;
  userRole: string;
  onDependenciesChange: (next: TaskDependencyLink[]) => void;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdateSuccess,
  allTasks,
  dependencies,
  delayRisk,
  userId,
  userRole,
  onDependenciesChange,
}: TaskDetailModalProps) {
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"todo" | "in_progress" | "review" | "done">("todo");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Predecessor picker
  const [selectedDependsOn, setSelectedDependsOn] = useState("");
  const [isAddingDependency, setIsAddingDependency] = useState(false);
  const [removingLinkId, setRemovingLinkId] = useState<string | null>(null);
  const [dependencyError, setDependencyError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setStatus(task.status || "todo");
      setPriority(task.priority || "medium");
      setStartDate(task.start_date || task.created_at?.slice(0, 10) || "");
      setDueDate(task.due_date || "");
      setErrorMsg(null);
      setSelectedDependsOn("");
      setDependencyError(null);
    }
  }, [task]);

  if (!isOpen || !task) return null;

  // Mirrors task_dependencies_insert/delete RLS: the task's own assignee, or
  // admin/PM. Gating the UI too so it doesn't offer a control that RLS will
  // just reject.
  const canManageDependencies =
    userRole === "admin" || userRole === "project_manager" || task.assignee_id === userId;

  // Predecessors already linked onto this task, resolved to their titles.
  const predecessorLinks = dependencies
    .filter((d) => d.task_id === task.id)
    .map((link) => ({ link, task: allTasks.find((t) => t.id === link.depends_on_task_id) }))
    .filter((x): x is { link: TaskDependencyLink; task: any } => !!x.task);

  // Everything else in the project that isn't already a predecessor and
  // isn't this task itself — candidates for a new dependency link.
  const candidateTasks = allTasks.filter(
    (t) => t.id !== task.id && !predecessorLinks.some((p) => p.link.depends_on_task_id === t.id)
  );

  const handleAddDependency = async () => {
    if (!selectedDependsOn) return;
    setDependencyError(null);

    if (wouldCreateCycle(task.id, selectedDependsOn, dependencies)) {
      setDependencyError("That would create a circular dependency — pick a different task.");
      return;
    }

    setIsAddingDependency(true);
    const res = await addTaskDependency(supabase, task.id, selectedDependsOn, userId);
    setIsAddingDependency(false);

    if (!res.success || !res.data) {
      setDependencyError(res.error || "Failed to add dependency.");
      return;
    }

    onDependenciesChange([...dependencies, res.data]);
    setSelectedDependsOn("");
  };

  const handleRemoveDependency = async (linkId: string) => {
    setDependencyError(null);
    setRemovingLinkId(linkId);
    const res = await removeTaskDependency(supabase, linkId);
    setRemovingLinkId(null);

    if (!res.success) {
      setDependencyError(res.error || "Failed to remove dependency.");
      return;
    }

    onDependenciesChange(dependencies.filter((d) => d.id !== linkId));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMsg("Task title is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const updatePayload: any = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      start_date: startDate || null,
      due_date: dueDate || null,
    };

    if (status === "done" && task.status !== "done") {
      updatePayload.completed_at = new Date().toISOString();
    } else if (status !== "done" && task.status === "done") {
      updatePayload.completed_at = null;
    }

    const { data, error } = await (supabase.from("tasks") as any)
      .update(updatePayload)
      .eq("id", task.id)
      .select("*")
      .single();

    setIsSubmitting(false);

    if (error || !data) {
      setErrorMsg(error?.message || "Failed to update task.");
    } else {
      onUpdateSuccess({
        ...task,
        ...data,
      });
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-primary" />
            Task Details & Scheduling
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {delayRisk && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <Zap className="w-4 h-4 shrink-0 text-amber-600" />
                <span>{delayRisk.level === "high" ? "High" : "Medium"} risk of delay</span>
              </div>
              <ul className="pl-6 list-disc space-y-0.5 text-amber-700 dark:text-amber-400/90">
                {delayRisk.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Task Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Task instructions and work package requirements…"
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Completed (Done)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div className="p-3 bg-secondary/50 rounded-xl border border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Assignee:</span>
            {task.assignee_id && task.assignee_name ? (
              <Link href={`/profile/${task.assignee_id}`} className="font-semibold text-primary hover:underline">
                {task.assignee_name}
              </Link>
            ) : (
              <span className="font-semibold text-foreground">Unassigned</span>
            )}
          </div>

          {/* Depends On — predecessor tasks that must finish before this one starts */}
          <div className="p-3 bg-secondary/50 rounded-xl border border-border space-y-2.5">
            <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-indigo-500" />
              Depends On
            </label>

            {predecessorLinks.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">No predecessors — this task can start any time.</p>
            ) : (
              <ul className="space-y-1.5">
                {predecessorLinks.map(({ link, task: dep }) => (
                  <li
                    key={link.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs"
                  >
                    <span className="truncate text-foreground font-medium">{dep.title}</span>
                    {canManageDependencies && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDependency(link.id)}
                        disabled={removingLinkId === link.id}
                        className="text-muted-foreground hover:text-rose-500 disabled:opacity-50 shrink-0"
                        title="Remove dependency"
                      >
                        {removingLinkId === link.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <X className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {canManageDependencies && candidateTasks.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDependsOn}
                  onChange={(e) => setSelectedDependsOn(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Add a predecessor…</option>
                  {candidateTasks.map((t) => {
                    const disabled = wouldCreateCycle(task.id, t.id, dependencies);
                    return (
                      <option key={t.id} value={t.id} disabled={disabled}>
                        {t.title}
                        {disabled ? " (would create a cycle)" : ""}
                      </option>
                    );
                  })}
                </select>
                <button
                  type="button"
                  onClick={handleAddDependency}
                  disabled={!selectedDependsOn || isAddingDependency}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-all shrink-0"
                >
                  {isAddingDependency ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Add
                </button>
              </div>
            )}

            {dependencyError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">{dependencyError}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
