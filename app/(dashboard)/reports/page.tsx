import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center">
        <BarChart3 className="w-7 h-7 text-amber-600 dark:text-amber-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Reports</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Analytics dashboards, budget burn-down, and attendance reports are coming in Phase 2.
      </p>
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900">
        Coming soon
      </span>
    </div>
  );
}
