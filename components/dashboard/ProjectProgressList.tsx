import { cn } from "@/lib/utils";

interface Project {
  id: string;
  name: string;
  manager: string;
  progress: number;
  status: "on_track" | "at_risk" | "delayed";
  dueDate: string;
}

const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Sunrise Residency – Tower A",
    manager: "Amit Sharma",
    progress: 68,
    status: "on_track",
    dueDate: "31 Oct 2026",
  },
  {
    id: "p2",
    name: "NH-48 Bridge Widening",
    manager: "Priya Nair",
    progress: 34,
    status: "at_risk",
    dueDate: "15 Dec 2026",
  },
  {
    id: "p3",
    name: "Greenfield IT Park – Phase 2",
    manager: "Rohan Mehta",
    progress: 89,
    status: "on_track",
    dueDate: "20 Aug 2026",
  },
  {
    id: "p4",
    name: "Metro Station Fit-Out",
    manager: "Sunita Rao",
    progress: 12,
    status: "delayed",
    dueDate: "28 Feb 2027",
  },
];

const statusConfig = {
  on_track: { label: "On Track",  dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  at_risk:  { label: "At Risk",   dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  delayed:  { label: "Delayed",   dot: "bg-rose-500",    text: "text-rose-600 dark:text-rose-400" },
};

const progressColor = (p: number, status: Project["status"]) => {
  if (status === "delayed") return "bg-rose-500";
  if (status === "at_risk")  return "bg-amber-500";
  return "bg-indigo-500";
};

export function ProjectProgressList() {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-semibold text-foreground text-base">Project Progress</h3>
        <span className="text-xs text-muted-foreground">{PROJECTS.length} active</span>
      </div>

      <div className="space-y-5">
        {PROJECTS.map((project) => {
          const config = statusConfig[project.status];
          return (
            <div key={project.id} id={`project-row-${project.id}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="min-w-0 flex-1 pr-4">
                  <p className="text-sm font-medium text-foreground truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{project.manager} · Due {project.dueDate}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />
                  <span className={cn("text-xs font-medium", config.text)}>{config.label}</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all duration-500", progressColor(project.progress, project.status))}
                  style={{ width: `${project.progress}%` }}
                  role="progressbar"
                  aria-valuenow={project.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${project.name}: ${project.progress}% complete`}
                />
              </div>
              <p className="text-right text-xs text-muted-foreground mt-1">{project.progress}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
