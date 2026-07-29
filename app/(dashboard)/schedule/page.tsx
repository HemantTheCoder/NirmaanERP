import type { Metadata } from "next";
import { CalendarDays } from "lucide-react";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center">
        <CalendarDays className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Schedule</h2>
      <p className="text-muted-foreground text-sm max-w-sm">
        Gantt charts, milestone tracking, and site visit scheduling are coming in Phase 2.
      </p>
      <span className="text-xs font-medium px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900">
        Coming soon
      </span>
    </div>
  );
}
