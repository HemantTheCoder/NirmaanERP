"use client";

import { useState } from "react";
import {
  IndianRupee,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  PieChart as PieIcon,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import {
  logExpense,
  updateExpenseStatus,
  type ProjectBudgetSummary,
  type ExpenseCategory,
  type ExpenseItem,
} from "@/lib/queries/finance";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProjectBudgetViewProps {
  projectId: string;
  initialSummary: ProjectBudgetSummary;
  user: {
    id: string;
    role: UserRole;
  };
}

const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  labor: "Labor & Manpower",
  materials: "Materials & Supplies",
  equipment_rental: "Equipment & Machinery Rental",
  subcontractor: "Subcontractor Work",
  other: "Miscellaneous / Other",
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  labor: "#6366f1", // indigo
  materials: "#10b981", // emerald
  equipment_rental: "#f59e0b", // amber
  subcontractor: "#8b5cf6", // violet
  other: "#64748b", // slate
};

const STATUS_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  pending:  { label: "Pending Approval", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  approved: { label: "Approved",         bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  rejected: { label: "Rejected",         bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
};

export function ProjectBudgetView({
  projectId,
  initialSummary,
  user,
}: ProjectBudgetViewProps) {
  const supabase = createClient();
  const [summary, setSummary] = useState<ProjectBudgetSummary>(initialSummary);

  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [rejectingExpense, setRejectingExpense] = useState<ExpenseItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Log Form states
  const [category, setCategory] = useState<ExpenseCategory>("materials");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isStaff = user.role === "admin" || user.role === "project_manager";

  const formatCurrency = (val: number | null) => {
    if (val === null || val === undefined) return "Not Set";
    return `₹${val.toLocaleString("en-IN")}`;
  };

  const handleLogExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      setErrorMsg("Please enter a valid expense amount greater than 0.");
      return;
    }
    if (!description.trim()) {
      setErrorMsg("Please enter a brief description for this expense.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await logExpense(
      supabase,
      {
        project_id: projectId,
        category,
        amount: numAmount,
        description: description.trim(),
      },
      user.id
    );

    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.error || "Failed to log expense.");
    } else {
      setSuccessMsg("Expense logged successfully and sent for manager approval!");
      setIsLogModalOpen(false);
      setCategory("materials");
      setAmount("");
      setDescription("");

      // Update local state
      setSummary((prev) => ({
        ...prev,
        totalPendingSpend: prev.totalPendingSpend + numAmount,
        expenses: [res.data!, ...prev.expenses],
      }));
    }
  };

  const handleApprove = async (expense: ExpenseItem) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await updateExpenseStatus(supabase, expense.id, "approved", user.id);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to approve expense.");
    } else {
      setSuccessMsg(`Expense for ₹${expense.amount.toLocaleString("en-IN")} approved!`);
      // Update local summary
      setSummary((prev) => {
        const updatedExpenses = prev.expenses.map((e) =>
          e.id === expense.id
            ? { ...e, status: "approved" as const, approved_by: user.id, approved_at: new Date().toISOString() }
            : e
        );

        const newApprovedSpend = prev.totalApprovedSpend + expense.amount;
        const newPendingSpend = Math.max(0, prev.totalPendingSpend - expense.amount);
        const newRemaining = prev.budgetAllocated !== null ? prev.budgetAllocated - newApprovedSpend : null;
        const newPct =
          prev.budgetAllocated && prev.budgetAllocated > 0
            ? Math.round((newApprovedSpend / prev.budgetAllocated) * 100)
            : null;

        const newBreakdown = {
          ...prev.categoryBreakdown,
          [expense.category]: (prev.categoryBreakdown[expense.category] || 0) + expense.amount,
        };

        return {
          ...prev,
          totalApprovedSpend: newApprovedSpend,
          totalPendingSpend: newPendingSpend,
          remainingBudget: newRemaining,
          usedPercentage: newPct,
          categoryBreakdown: newBreakdown,
          expenses: updatedExpenses,
        };
      });
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingExpense) return;
    if (!rejectionReason.trim()) {
      setErrorMsg("Rejection reason is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await updateExpenseStatus(
      supabase,
      rejectingExpense.id,
      "rejected",
      user.id,
      rejectionReason.trim()
    );

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to reject expense.");
    } else {
      setSuccessMsg("Expense request rejected.");
      const rejectedId = rejectingExpense.id;
      const rejectedAmount = rejectingExpense.amount;

      setSummary((prev) => ({
        ...prev,
        totalPendingSpend: Math.max(0, prev.totalPendingSpend - rejectedAmount),
        expenses: prev.expenses.map((e) =>
          e.id === rejectedId
            ? {
                ...e,
                status: "rejected" as const,
                approved_by: user.id,
                rejection_reason: rejectionReason.trim(),
                approved_at: new Date().toISOString(),
              }
            : e
        ),
      }));

      setRejectingExpense(null);
      setRejectionReason("");
    }
  };

  // Recharts Chart Data
  const chartData = Object.entries(summary.categoryBreakdown).map(([cat, value]) => ({
    name: CATEGORY_LABELS[cat as ExpenseCategory] || cat,
    category: cat as ExpenseCategory,
    amount: value,
  }));

  const isOverBudget = summary.remainingBudget !== null && summary.remainingBudget < 0;
  const pct = summary.usedPercentage || 0;

  // Progress Bar Color Logic
  let progressBarColor = "bg-emerald-500";
  if (pct >= 100 || isOverBudget) {
    progressBarColor = "bg-rose-500 animate-pulse";
  } else if (pct >= 80) {
    progressBarColor = "bg-amber-500";
  }

  return (
    <div className="space-y-6">
      {/* Banner Error / Success */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Row with Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Project Budget & Expense Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Per-project financial allocation, expense logging, trade category spend, and approval controls.
          </p>
        </div>

        <button
          onClick={() => setIsLogModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Log Project Expense
        </button>
      </div>

      {/* Financial KPI Summary Cards (Admin & PM only) */}
      {isStaff && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Allocated Budget */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
              <p className="text-xs font-medium text-muted-foreground">Allocated Budget</p>
              <p className="text-2xl font-bold text-foreground mt-1">
                {formatCurrency(summary.budgetAllocated)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.budgetAllocated ? "Approved baseline financial cap" : "Budget cap not configured"}
              </p>
            </div>

            {/* Total Approved Spend */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
              <p className="text-xs font-medium text-muted-foreground">Approved Actual Spend</p>
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
                {formatCurrency(summary.totalApprovedSpend)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.totalPendingSpend > 0 ? `+ ₹${summary.totalPendingSpend.toLocaleString("en-IN")} pending approval` : "All logged expenses processed"}
              </p>
            </div>

            {/* Remaining Budget / Variance */}
            <div
              className={cn(
                "bg-card border rounded-2xl p-4 shadow-xs",
                isOverBudget ? "border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/20" : "border-border"
              )}
            >
              <p className="text-xs font-medium text-muted-foreground flex items-center justify-between">
                <span>Remaining Budget</span>
                {isOverBudget && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                    OVER BUDGET
                  </span>
                )}
              </p>
              <p
                className={cn(
                  "text-2xl font-bold mt-1",
                  isOverBudget ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}
              >
                {formatCurrency(summary.remainingBudget)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {summary.remainingBudget !== null
                  ? isOverBudget
                    ? `Exceeds allocated cap by ₹${Math.abs(summary.remainingBudget).toLocaleString("en-IN")}`
                    : "Available allocation remaining"
                  : "Set project budget to enable cap tracking"}
              </p>
            </div>

            {/* Budget Utilization % */}
            <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">Budget Utilization</p>
                  <span className="text-xs font-bold text-foreground">{pct}%</span>
                </div>
                <div className="w-full bg-secondary h-2.5 rounded-full mt-2.5 overflow-hidden">
                  <div
                    className={cn("h-full transition-all duration-500 rounded-full", progressBarColor)}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {pct >= 100
                  ? "Critical: Project has exceeded 100% budget"
                  : pct >= 80
                  ? "Warning: Budget utilization above 80%"
                  : "Financial burn rate within normal limits"}
              </p>
            </div>
          </div>

          {/* Category Spend Breakdown Chart */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <PieIcon className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-bold text-foreground">Approved Spend by Trade Category</h3>
              </div>
              <span className="text-xs text-muted-foreground">Approved Expenses Only</span>
            </div>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <Tooltip
                    formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Approved Spend"]}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      borderColor: "var(--border)",
                      borderRadius: "0.75rem",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[entry.category]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Expenses List Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" />
            Project Expense Register
            <span className="text-xs font-normal text-muted-foreground">
              ({summary.expenses.length} records)
            </span>
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Trade Category</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Logged By</th>
                <th className="px-4 py-3 text-right">Amount (₹)</th>
                <th className="px-4 py-3 text-center">Status</th>
                {isStaff && <th className="px-4 py-3 text-right">Review Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.expenses.length === 0 ? (
                <tr>
                  <td colSpan={isStaff ? 7 : 6} className="text-center py-10 text-muted-foreground">
                    No expense entries recorded for this project.
                  </td>
                </tr>
              ) : (
                summary.expenses.map((expense) => {
                  const statusCfg = STATUS_BADGES[expense.status] || STATUS_BADGES.pending;

                  return (
                    <tr key={expense.id} className="hover:bg-muted/40 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3.5 font-medium text-foreground whitespace-nowrap">
                        {new Date(expense.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold text-white"
                          style={{ backgroundColor: CATEGORY_COLORS[expense.category] }}
                        >
                          {CATEGORY_LABELS[expense.category]}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3.5 max-w-xs truncate text-foreground font-medium">
                        {expense.description}
                        {expense.rejection_reason && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5 font-normal truncate">
                            Reason: {expense.rejection_reason}
                          </p>
                        )}
                      </td>

                      {/* Logged By */}
                      <td className="px-4 py-3.5 text-muted-foreground whitespace-nowrap">
                        {expense.logger?.full_name || expense.logger?.email || "Unknown"}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3.5 text-right font-bold text-foreground whitespace-nowrap">
                        ₹{expense.amount.toLocaleString("en-IN")}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
                            statusCfg.bg,
                            statusCfg.text
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Admin/PM Actions */}
                      {isStaff && (
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          {expense.status === "pending" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleApprove(expense)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 text-white hover:bg-emerald-500 rounded-lg transition-all shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectingExpense(expense)}
                                disabled={isSubmitting}
                                className="px-2.5 py-1 text-[11px] font-semibold bg-rose-600 text-white hover:bg-rose-500 rounded-lg transition-all shadow-xs"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-medium">
                              Reviewed by {expense.approver?.full_name?.split(" ")[0] || "Manager"}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Expense Modal */}
      {isLogModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Log Project Expense
              </h3>
              <button onClick={() => setIsLogModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogExpenseSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Trade Category <span className="text-rose-500">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Expense Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 45000"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Expense Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Details of material purchase, labor dispatch, or equipment rental invoice..."
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Expense Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-rose-50 dark:bg-rose-950/40">
              <h3 className="font-bold text-rose-800 dark:text-rose-300 text-base flex items-center gap-2">
                <XCircle className="w-4 h-4 text-rose-600" /> Reject Expense Request
              </h3>
              <button onClick={() => setRejectingExpense(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="p-6 space-y-4">
              <p className="text-xs text-muted-foreground">
                Rejecting expense of <strong className="text-foreground">₹{rejectingExpense.amount.toLocaleString("en-IN")}</strong> for &quot;{rejectingExpense.description}&quot;.
              </p>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Rejection Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Provide reason for rejecting this expense request..."
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setRejectingExpense(null)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
