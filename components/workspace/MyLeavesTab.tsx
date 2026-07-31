"use client";

import { useState } from "react";
import { Plus, Calendar, Clock, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import type { LeaveItem } from "@/lib/queries/leaves";
import { RequestLeaveModal } from "./RequestLeaveModal";
import { cn } from "@/lib/utils";

interface MyLeavesTabProps {
  initialLeaves: LeaveItem[];
  userId: string;
}

const TYPE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  casual: { label: "Casual Leave", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  sick:   { label: "Sick Leave",   bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  earned: { label: "Earned Leave", bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  unpaid: { label: "Unpaid Leave", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: any; bg: string; text: string }> = {
  pending:  { label: "Pending Approval", icon: Clock,        bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  approved: { label: "Approved",         icon: CheckCircle2, bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  rejected: { label: "Rejected",         icon: XCircle,      bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
};

export function MyLeavesTab({ initialLeaves, userId }: MyLeavesTabProps) {
  const [leaves, setLeaves] = useState<LeaveItem[]>(initialLeaves);
  const [showModal, setShowModal] = useState(false);

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.ceil((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
    return diff > 0 ? diff : 1;
  };

  const handleSuccess = (newLeave: LeaveItem) => {
    setLeaves((prev) => [newLeave, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border shadow-sm">
        <div>
          <h3 className="text-sm font-bold text-foreground">My Leave Requests</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit leave requests and monitor manager approval statuses.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Request Leave
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Leave Type</th>
                <th className="px-5 py-3.5">Dates & Duration</th>
                <th className="px-5 py-3.5">Reason</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {leaves.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-muted-foreground">
                    You have not submitted any leave requests yet.
                  </td>
                </tr>
              ) : (
                leaves.map((l) => {
                  const typeCfg = TYPE_CONFIG[l.type] || TYPE_CONFIG.casual;
                  const statusCfg = STATUS_CONFIG[l.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  const days = calculateDays(l.start_date, l.end_date);

                  return (
                    <tr key={l.id} className="hover:bg-muted/40 transition-colors">
                      {/* Leave Type */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-block px-2.5 py-1 rounded-md text-xs font-semibold",
                            typeCfg.bg,
                            typeCfg.text
                          )}
                        >
                          {typeCfg.label}
                        </span>
                      </td>

                      {/* Date Range & Duration */}
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-foreground">
                          {new Date(l.start_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          –{" "}
                          {new Date(l.end_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {days} {days === 1 ? "day" : "days"}
                        </span>
                      </td>

                      {/* Reason */}
                      <td className="px-5 py-3.5 max-w-xs">
                        <p className="text-foreground truncate">{l.reason || "—"}</p>
                        {l.status === "rejected" && l.rejection_reason && (
                          <div className="mt-1 flex items-start gap-1 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                            <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Rejection reason: {l.rejection_reason}</span>
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold",
                            statusCfg.bg,
                            statusCfg.text
                          )}
                        >
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Submitted Date */}
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(l.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Leave Modal */}
      <RequestLeaveModal
        isOpen={showModal}
        userId={userId}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
