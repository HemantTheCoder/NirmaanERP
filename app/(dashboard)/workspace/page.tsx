import type { Metadata } from "next";
import { Briefcase } from "lucide-react";

export const metadata: Metadata = { title: "My Workspace" };

export default function WorkspacePage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center">
        <Briefcase className="w-7 h-7 text-violet-600 dark:text-violet-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">My Workspace</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Personal task board, time logs, and leave management are coming in Phase 2.
      </p>
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-violet-50 dark:bg-violet-950/50 text-violet-600 dark:text-violet-400 border border-violet-100 dark:border-violet-900">
        Coming soon
      </span>
    </div>
  );
}
