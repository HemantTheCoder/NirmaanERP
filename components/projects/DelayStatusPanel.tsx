"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  ShieldAlert,
  History,
  Clock,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reportDelay, rectifyDelay, type ProjectDelay } from "@/lib/queries/delays";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface DelayStatusPanelProps {
  projectId: string;
  initialOpenDelay: ProjectDelay | null;
  initialHistory: ProjectDelay[];
  user: { id: string; role: UserRole };
}

export function DelayStatusPanel({
  projectId,
  initialOpenDelay,
  initialHistory,
  user,
}: DelayStatusPanelProps) {
  const router = useRouter();
  const supabase = createClient();

  const [openDelay, setOpenDelay] = useState<ProjectDelay | null>(initialOpenDelay);
  const [history, setHistory] = useState<ProjectDelay[]>(initialHistory);

  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isRectifyOpen, setIsRectifyOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Site staff can report what they see on site; closing a delay is a
  // management sign-off, so rectify is admin/PM only (mirrors the RLS policy).
  const canReport =
    user.role === "admin" || user.role === "project_manager" || user.role === "site_staff";
  const canRectify = user.role === "admin" || user.role === "project_manager";

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const res = await reportDelay(supabase, {
      projectId,
      reason,
      reportedBy: user.id,
    });

    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setError(res.error || "Failed to report delay.");
      return;
    }

    setOpenDelay(res.data);
    setHistory((prev) => [res.data!, ...prev]);
    setReason("");
    setIsReportOpen(false);
    router.refresh();
  }

  async function handleRectify(e: React.FormEvent) {
    e.preventDefault();
    if (!openDelay) return;

    setIsSubmitting(true);
    setError(null);

    const res = await rectifyDelay(supabase, openDelay.id, notes, user.id);

    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setError(res.error || "Failed to mark delay rectified.");
      return;
    }

    setOpenDelay(null);
    setHistory((prev) => prev.map((d) => (d.id === res.data!.id ? res.data! : d)));
    setNotes("");
    setIsRectifyOpen(false);
    router.refresh();
  }

  function closeModals() {
    setIsReportOpen(false);
    setIsRectifyOpen(false);
    setError(null);
  }

  const rectifiedCount = history.filter((d) => d.status === "rectified").length;

  return (
    <>
      {/* Status banner */}
      <div
        className={cn(
          "rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
          openDelay
            ? "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900"
            : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900"
        )}
      >
        <div className="flex items-start gap-3 min-w-0">
          {openDelay ? (
            <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          )}

          <div className="min-w-0">
            {openDelay ? (
              <>
                <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
                  Delay Active — reported{" "}
                  {new Date(openDelay.reported_date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
                <p className="text-xs text-rose-700 dark:text-rose-300/90 mt-0.5 break-words">
                  {openDelay.reason}
                </p>
                {openDelay.reporter_name && (
                  <p className="text-[11px] text-rose-600/80 dark:text-rose-400/70 mt-1">
                    Reported by {openDelay.reporter_name}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">
                  On Track — no active delay
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300/90 mt-0.5">
                  {rectifiedCount > 0
                    ? `${rectifiedCount} previous delay${rectifiedCount === 1 ? "" : "s"} rectified`
                    : "No delays have been reported on this project"}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {history.length > 0 && (
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-card border border-border text-foreground text-xs font-semibold rounded-xl hover:bg-muted/50 transition-all"
            >
              <History className="w-3.5 h-3.5" />
              {showHistory ? "Hide" : "History"} ({history.length})
            </button>
          )}

          {openDelay
            ? canRectify && (
                <button
                  onClick={() => setIsRectifyOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark Rectified
                </button>
              )
            : canReport && (
                <button
                  onClick={() => setIsReportOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Report Delay
                </button>
              )}
        </div>
      </div>

      {/* Delay history log */}
      {showHistory && history.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-500" />
            Delay Log
          </h4>

          <div className="divide-y divide-border">
            {history.map((d) => (
              <div key={d.id} className="py-3 space-y-1">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span
                    className={cn(
                      "text-[11px] font-semibold px-2 py-0.5 rounded-lg",
                      d.status === "open"
                        ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                        : "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                    )}
                  >
                    {d.status === "open" ? "Open" : "Rectified"}
                  </span>

                  <span className="text-[11px] text-muted-foreground">
                    Reported{" "}
                    {new Date(d.reported_date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                    {d.reporter_name && ` by ${d.reporter_name}`}
                    {d.days_to_rectify !== null && d.days_to_rectify !== undefined && (
                      <>
                        {" · "}
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {d.days_to_rectify} day{d.days_to_rectify === 1 ? "" : "s"} to rectify
                        </span>
                      </>
                    )}
                  </span>
                </div>

                <p className="text-xs text-foreground">{d.reason}</p>

                {d.rectification_notes && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Rectification:</span>{" "}
                    {d.rectification_notes}
                    {d.rectifier_name && ` (${d.rectifier_name})`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Report Delay modal */}
      {isReportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                Report Delay
              </h2>
              <button onClick={closeModals} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReport} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Reason for delay <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Ready-mix concrete supply disrupted by monsoon flooding on the approach road"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Recording why the project slipped is what makes the delay log useful later.
                </p>
              </div>

              {error && (
                <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModals}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !reason.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Report Delay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mark Rectified modal */}
      {isRectifyOpen && openDelay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Mark Delay Rectified
              </h2>
              <button onClick={closeModals} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRectify} className="p-5 space-y-4">
              <div className="p-3 rounded-xl bg-secondary/40 border border-border">
                <p className="text-[11px] text-muted-foreground font-medium">Original delay</p>
                <p className="text-xs text-foreground mt-0.5">{openDelay.reason}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Rectification notes <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Alternate supplier engaged; approach road regraded and drainage cleared"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  This is sent to whoever reported the delay.
                </p>
              </div>

              {error && (
                <div className="text-xs text-rose-600 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeModals}
                  className="flex-1 px-4 py-2 text-xs font-semibold rounded-xl border border-border text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !notes.trim()}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Mark Rectified
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
