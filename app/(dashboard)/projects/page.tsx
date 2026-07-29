import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 flex items-center justify-center">
        <FolderKanban className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Projects</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Full project CRUD — create, assign, track milestones — is coming in Phase 2.
      </p>
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900">
        Coming soon
      </span>
    </div>
  );
}
