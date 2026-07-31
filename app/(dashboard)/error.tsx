"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/50 flex items-center justify-center">
        <AlertTriangle className="w-7 h-7 text-rose-600 dark:text-rose-400" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-foreground">Something went wrong</h2>
        <p className="text-sm text-muted-foreground max-w-md mt-1">
          An unexpected error occurred while loading this section. You can try refreshing the view.
        </p>
      </div>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Try Again
      </button>
    </div>
  );
}
