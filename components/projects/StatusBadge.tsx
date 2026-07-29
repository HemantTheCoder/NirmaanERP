"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/lib/queries/projects";
import { ChevronDown, Loader2 } from "lucide-react";

interface StatusBadgeProps {
  status: ProjectStatus;
  canEdit?: boolean;
  onStatusChange?: (newStatus: ProjectStatus) => Promise<void>;
}

const statusConfig: Record<
  ProjectStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  planning: {
    label: "Planning",
    bg: "bg-slate-100 dark:bg-slate-800",
    text: "text-slate-700 dark:text-slate-300",
    dot: "bg-slate-400",
  },
  active: {
    label: "Active",
    bg: "bg-emerald-50 dark:bg-emerald-950/50",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  on_hold: {
    label: "On Hold",
    bg: "bg-amber-50 dark:bg-amber-950/50",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  completed: {
    label: "Completed",
    bg: "bg-indigo-50 dark:bg-indigo-950/50",
    text: "text-indigo-700 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
};

const ALL_STATUSES: ProjectStatus[] = ["planning", "active", "on_hold", "completed"];

export function StatusBadge({ status, canEdit = false, onStatusChange }: StatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const current = statusConfig[status];

  const handleSelect = async (newStatus: ProjectStatus) => {
    if (newStatus === status || !onStatusChange) {
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(false);
    try {
      await onStatusChange(newStatus);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={!canEdit || isLoading}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all",
          current.bg,
          current.text,
          canEdit ? "hover:ring-2 hover:ring-indigo-500/20 cursor-pointer" : "cursor-default"
        )}
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <span className={cn("w-1.5 h-1.5 rounded-full", current.dot)} />
        )}
        <span>{current.label}</span>
        {canEdit && <ChevronDown className="w-3 h-3 ml-0.5 opacity-60" />}
      </button>

      {isOpen && canEdit && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-36 rounded-lg bg-card border border-border shadow-lg py-1 z-20">
            {ALL_STATUSES.map((s) => {
              const cfg = statusConfig[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleSelect(s)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 text-xs font-medium flex items-center gap-2 hover:bg-muted transition-colors",
                    s === status ? "font-bold text-foreground" : "text-muted-foreground"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", cfg.dot)} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
