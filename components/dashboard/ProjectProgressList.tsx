import { cn } from "@/lib/utils";
import type { ProjectProgressData } from "@/lib/queries/projects";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

interface ProjectProgressListProps {
  projects: ProjectProgressData[];
}

const statusConfig = {
  planning:  { label: "Planning",   dot: "bg-slate-400", text: "text-muted-foreground" },
  active:    { label: "Active",     dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  on_hold:   { label: "On Hold",    dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  completed: { label: "Completed",  dot: "bg-indigo-500",  text: "text-indigo-600 dark:text-indigo-400" },
};

export function ProjectProgressList({ projects }: ProjectProgressListProps) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground text-base">Project Progress</h3>
        <span className="text-xs text-muted-foreground">{projects.length} total</span>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <FolderKanban className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No projects found in database.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {projects.map((project) => {
            const config = statusConfig[project.status] || statusConfig.planning;
            return (
              <div key={project.id} id={`project-row-${project.id}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="min-w-0 flex-1 pr-4">
                    <Link
                      href={`/projects/${project.id}`}
                      className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block"
                    >
                      {project.name}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {project.manager_name ? `${project.manager_name} · ` : ""}
                      {project.end_date ? `Due ${project.end_date}` : "No deadline"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                    <span className={cn("text-xs font-medium", config.text)}>{config.label}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                    style={{ width: `${project.progress_pct}%` }}
                    role="progressbar"
                    aria-valuenow={project.progress_pct}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${project.name}: ${project.progress_pct}% complete`}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-1">
                  <span>
                    {project.completed_tasks} of {project.total_tasks} tasks done
                  </span>
                  <span className="font-semibold text-foreground">{project.progress_pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
