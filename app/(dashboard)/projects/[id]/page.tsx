import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/lib/queries/projects";
import { StatusBadge } from "@/components/projects/StatusBadge";
import {
  ArrowLeft,
  Calendar,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
} from "lucide-react";

export const dynamic = "force-dynamic";

interface ProjectDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ProjectDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const res = await getProjectById(supabase, id);
  return {
    title: res ? res.project.name : "Project Details",
  };
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const data = await getProjectById(supabase, id);
  if (!data) {
    notFound();
  }

  const { project, tasks } = data;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === "done").length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

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
              <h2 className="text-2xl font-bold text-foreground">{project.name}</h2>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-slate-500 text-sm max-w-2xl">
              {project.description || "No description provided."}
            </p>
          </div>
        </div>
      </div>

      {/* Meta Bar */}
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

      {/* Associated Tasks Section */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground text-base">
            Project Tasks ({totalTasks})
          </h3>
        </div>

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
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{task.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>Assignee: {task.assignee_name || "Unassigned"}</span>
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
    </div>
  );
}
