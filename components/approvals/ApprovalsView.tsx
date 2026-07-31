"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Check, X, AlertTriangle, Loader2, History, Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateLeaveStatus, type LeaveItem } from "@/lib/queries/leaves";
import { cn } from "@/lib/utils";

interface ApprovalsViewProps {
  initialPending: LeaveItem[];
  initialHistory: LeaveItem[];
  currentUserId: string;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  casual: { label: "Casual Leave", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  sick:   { label: "Sick Leave",   bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  earned: { label: "Earned Leave", bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  unpaid: { label: "Unpaid Leave", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
};

export function ApprovalsView({ initialPending, initialHistory, currentUserId }: ApprovalsViewProps) {
  const supabase = createClient();

  const [pendingLeaves, setPendingLeaves] = useState<LeaveItem[]>(initialPending);
  const [historyLeaves, setHistoryLeaves] = useState<LeaveItem[]>(initialHistory);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reject Modal state
  const [leaveToReject, setLeaveToReject] = useState<LeaveItem | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleApprove = async (leave: LeaveItem) => {
    setActionLoadingId(leave.id);
    setErrorMsg(null);

    const res = await updateLeaveStatus(supabase, {
      leaveId: leave.id,
      status: "approved",
      approvedBy: currentUserId,
    });

    setActionLoadingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to approve leave request.");
    } else {
      const updatedItem: LeaveItem = {
        ...leave,
        status: "approved",
        approved_by: currentUserId,
      };
      setPendingLeaves((prev) => prev.filter((l) => l.id !== leave.id));
      setHistoryLeaves((prev) => [updatedItem, ...prev]);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveToReject || !rejectionReasonInput.trim()) return;

    setIsSubmittingReject(true);
    setErrorMsg(null);

    const res = await updateLeaveStatus(supabase, {
      leaveId: leaveToReject.id,
      status: "rejected",
      approvedBy: currentUserId,
      rejectionReason: rejectionReasonInput.trim(),
    });

    setIsSubmittingReject(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to reject leave request.");
    } else {
      const updatedItem: LeaveItem = {
        ...leaveToReject,
        status: "rejected",
        approved_by: currentUserId,
        rejection_reason: rejectionReasonInput.trim(),
      };
      setPendingLeaves((prev) => prev.filter((l) => l.id !== leaveToReject.id));
      setHistoryLeaves((prev) => [updatedItem, ...prev]);
      setLeaveToReject(null);
      setRejectionReasonInput("");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Approvals Queue
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review and action employee leave requests across all projects.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-secondary/80 p-1 rounded-xl border border-border self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("pending")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
              activeTab === "pending"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            Pending Queue
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold">
              {pendingLeaves.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
              activeTab === "history"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="w-3.5 h-3.5 text-indigo-600" />
            Approval History
            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {historyLeaves.length}
            </span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Pending Queue Tab */}
      {activeTab === "pending" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Requester</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Dates & Duration</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No pending leave requests in queue.
                    </td>
                  </tr>
                ) : (
                  pendingLeaves.map((l) => {
                    const typeCfg = TYPE_CONFIG[l.type] || TYPE_CONFIG.casual;
                    const days = calculateDays(l.start_date, l.end_date);
                    const initials = (l.user?.full_name || l.user?.email || "User")
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase();

                    return (
                      <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                        {/* Requester */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0">
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-foreground leading-tight">
                                {l.user?.full_name || "Unnamed User"}
                              </p>
                              <p className="text-[11px] text-muted-foreground mt-0.5">{l.user?.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-block px-2.5 py-1 rounded-md text-xs font-semibold", typeCfg.bg, typeCfg.text)}>
                            {typeCfg.label}
                          </span>
                        </td>

                        {/* Dates */}
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-foreground">
                            {new Date(l.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
                            {new Date(l.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {days} {days === 1 ? "day" : "days"}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="px-5 py-3.5 max-w-xs text-foreground">
                          {l.reason || "—"}
                        </td>

                        {/* Submitted */}
                        <td className="px-5 py-3.5 text-muted-foreground">
                          {new Date(l.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        </td>

                        {/* Action Buttons */}
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(l)}
                              disabled={actionLoadingId === l.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs"
                            >
                              {actionLoadingId === l.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              Approve
                            </button>

                            <button
                              onClick={() => {
                                setLeaveToReject(l);
                                setRejectionReasonInput("");
                              }}
                              disabled={actionLoadingId === l.id}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-5 py-3.5">Requester</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Dates & Duration</th>
                  <th className="px-5 py-3.5">Reason</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Actioned By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No processed leave history records found.
                    </td>
                  </tr>
                ) : (
                  historyLeaves.map((l) => {
                    const typeCfg = TYPE_CONFIG[l.type] || TYPE_CONFIG.casual;
                    const days = calculateDays(l.start_date, l.end_date);
                    const isApproved = l.status === "approved";

                    return (
                      <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                        {/* Requester */}
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-foreground">{l.user?.full_name || "Unnamed User"}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{l.user?.email}</p>
                        </td>

                        {/* Type */}
                        <td className="px-5 py-3.5">
                          <span className={cn("inline-block px-2.5 py-1 rounded-md text-xs font-semibold", typeCfg.bg, typeCfg.text)}>
                            {typeCfg.label}
                          </span>
                        </td>

                        {/* Dates */}
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-foreground">
                            {new Date(l.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
                            {new Date(l.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <span className="text-[11px] text-muted-foreground">
                            {days} {days === 1 ? "day" : "days"}
                          </span>
                        </td>

                        {/* Reason */}
                        <td className="px-5 py-3.5 max-w-xs">
                          <p className="text-foreground truncate">{l.reason || "—"}</p>
                          {l.rejection_reason && (
                            <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-0.5">
                              Rejection note: {l.rejection_reason}
                            </p>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="px-5 py-3.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold",
                              isApproved
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                            )}
                          >
                            {isApproved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {isApproved ? "Approved" : "Rejected"}
                          </span>
                        </td>

                        {/* Actioned By */}
                        <td className="px-5 py-3.5 text-muted-foreground font-medium">
                          {l.approver?.full_name || "Admin"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {leaveToReject && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setLeaveToReject(null)}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <XCircle className="w-4.5 h-4.5" />
                Reject Leave Request
              </h3>
              <button onClick={() => setLeaveToReject(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-6 space-y-4">
              <p className="text-xs text-foreground">
                Rejecting leave request for <span className="font-bold">{leaveToReject.user?.full_name || leaveToReject.user?.email}</span> (
                {new Date(leaveToReject.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} –{" "}
                {new Date(leaveToReject.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}).
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Provide a clear reason for rejecting this leave request…"
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 placeholder:text-muted-foreground"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveToReject(null)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReject}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all shadow-xs"
                >
                  {isSubmittingReject && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Reject Leave
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
