"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, Check, X, AlertTriangle, Loader2, History, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateLeaveStatus, type LeaveItem } from "@/lib/queries/leaves";
import { createSignatureAcknowledgment } from "@/lib/queries/signatures";
import { SignatureConfirmModal } from "@/components/shared/SignatureConfirmModal";
import { cn } from "@/lib/utils";

interface ApprovalsViewProps {
  initialPending: LeaveItem[];
  initialHistory: LeaveItem[];
  currentUserId: string;
  currentUserFullName?: string;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  casual: { label: "Casual Leave", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  sick:   { label: "Sick Leave",   bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  earned: { label: "Earned Leave", bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  unpaid: { label: "Unpaid Leave", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
};

export function ApprovalsView({
  initialPending,
  initialHistory,
  currentUserId,
  currentUserFullName = "Manager",
}: ApprovalsViewProps) {
  const supabase = createClient();

  const [pendingLeaves, setPendingLeaves] = useState<LeaveItem[]>(initialPending);
  const [historyLeaves, setHistoryLeaves] = useState<LeaveItem[]>(initialHistory);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Digital Signature Modal state for Leave Approval
  const [leaveToApprove, setLeaveToApprove] = useState<LeaveItem | null>(null);

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

  const handleExecuteApproveWithSignature = async (typedName: string) => {
    if (!leaveToApprove) return;

    setActionLoadingId(leaveToApprove.id);
    setErrorMsg(null);

    // 1. Record Digital Signature Audit Acknowledgment
    await createSignatureAcknowledgment(
      supabase,
      {
        action_type: "leave_approval",
        reference_id: leaveToApprove.id,
        typed_name: typedName,
      },
      currentUserId
    );

    // 2. Update Leave Status
    const res = await updateLeaveStatus(supabase, {
      leaveId: leaveToApprove.id,
      status: "approved",
      approvedBy: currentUserId,
    });

    setActionLoadingId(null);
    const approvedLeave = leaveToApprove;
    setLeaveToApprove(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to approve leave request.");
    } else {
      const updatedItem: LeaveItem = {
        ...approvedLeave,
        status: "approved",
        approved_by: currentUserId,
      };

      setPendingLeaves((prev) => prev.filter((item) => item.id !== approvedLeave.id));
      setHistoryLeaves((prev) => [updatedItem, ...prev]);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveToReject) return;

    setIsSubmittingReject(true);
    setErrorMsg(null);

    const res = await updateLeaveStatus(supabase, {
      leaveId: leaveToReject.id,
      status: "rejected",
      approvedBy: currentUserId,
      rejectionReason: rejectionReasonInput.trim() || undefined,
    });

    setIsSubmittingReject(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to reject leave request.");
    } else {
      const updatedItem: LeaveItem = {
        ...leaveToReject,
        status: "rejected",
        approved_by: currentUserId,
        rejection_reason: rejectionReasonInput.trim() || null,
      };

      setPendingLeaves((prev) => prev.filter((item) => item.id !== leaveToReject.id));
      setHistoryLeaves((prev) => [updatedItem, ...prev]);
      setLeaveToReject(null);
      setRejectionReasonInput("");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Clock className="w-5 h-5 text-indigo-500" /> Approvals Queue
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review site employee leave applications and digitally sign authorization approvals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("pending")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2",
              activeTab === "pending"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Action ({pendingLeaves.length})
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2",
              activeTab === "history"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="w-3.5 h-3.5" />
            Approval History ({historyLeaves.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Content Tabs */}
      {activeTab === "pending" ? (
        <div className="space-y-4">
          {pendingLeaves.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">Approvals Queue is Clear!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                No pending leave applications requiring your review.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingLeaves.map((leave) => {
                const days = calculateDays(leave.start_date, leave.end_date);
                const typeCfg = TYPE_CONFIG[leave.type] || TYPE_CONFIG.casual;

                return (
                  <div
                    key={leave.id}
                    className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-indigo-500/40 transition-all"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold text-foreground text-sm">
                            {leave.user?.full_name || "Employee"}
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            {leave.user?.email}
                          </p>
                        </div>
                        <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold", typeCfg.bg, typeCfg.text)}>
                          {typeCfg.label}
                        </span>
                      </div>

                      <div className="p-3 bg-secondary/50 rounded-xl border border-border flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[11px] text-muted-foreground block">Period:</span>
                          <span className="font-semibold text-foreground">
                            {new Date(leave.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} →{" "}
                            {new Date(leave.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-muted-foreground block">Duration:</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{days} Day(s)</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] text-muted-foreground font-semibold block">Reason for Leave:</span>
                        <p className="text-xs text-foreground/90 bg-muted/30 p-2.5 rounded-lg border border-border/60 leading-relaxed">
                          {leave.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                      <button
                        onClick={() => {
                          setLeaveToReject(leave);
                          setRejectionReasonInput("");
                        }}
                        disabled={actionLoadingId === leave.id}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold hover:bg-rose-100 transition-all"
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>

                      <button
                        onClick={() => setLeaveToApprove(leave)}
                        disabled={actionLoadingId === leave.id}
                        className="flex items-center gap-1 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-60"
                      >
                        {actionLoadingId === leave.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ShieldCheck className="w-3.5 h-3.5" />
                        )}
                        Sign & Approve
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {historyLeaves.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-muted-foreground">
                      No past leave approval records found.
                    </td>
                  </tr>
                ) : (
                  historyLeaves.map((item) => {
                    const days = calculateDays(item.start_date, item.end_date);
                    const typeCfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.casual;

                    return (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">
                          {item.user?.full_name || "Employee"}
                          <span className="block text-[11px] font-normal text-muted-foreground">
                            {item.user?.email}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold", typeCfg.bg, typeCfg.text)}>
                            {typeCfg.label}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {new Date(item.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} -{" "}
                          {new Date(item.end_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ({days}d)
                        </td>

                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">
                          {item.reason}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={cn(
                              "inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                              item.status === "approved"
                                ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                                : "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                            )}
                          >
                            {item.status} (Digitally Signed)
                          </span>
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

      {/* Reject Reason Modal */}
      {leaveToReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-bold text-foreground text-sm">Reject Leave Application</h3>
            <p className="text-xs text-muted-foreground">
              Please state the reason for rejecting <strong>{leaveToReject.user?.full_name || "Employee"}</strong>&apos;s request.
            </p>

            <form onSubmit={handleConfirmReject} className="space-y-4">
              <textarea
                rows={3}
                required
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="e.g. Critical project deadline requires full team presence during this period..."
                className="w-full p-3 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <div className="flex items-center justify-end gap-2">
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
                  className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl shadow-xs disabled:opacity-60"
                >
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Signature Confirmation Modal for Leave Approval */}
      <SignatureConfirmModal
        isOpen={!!leaveToApprove}
        onClose={() => setLeaveToApprove(null)}
        onConfirm={handleExecuteApproveWithSignature}
        actionTitle="Confirm Leave Authorization"
        summaryText={`You are approving ${calculateDays(leaveToApprove?.start_date || "", leaveToApprove?.end_date || "")} day(s) of ${leaveToApprove?.type || "leave"} for ${leaveToApprove?.user?.full_name || "Employee"}.`}
        signerFullName={currentUserFullName}
        confirmButtonText="Confirm & Digitally Sign Leave"
      />
    </div>
  );
}
