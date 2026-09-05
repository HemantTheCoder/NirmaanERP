"use client";

import { useState } from "react";
import {
  Receipt,
  Plus,
  X,
  Loader2,
  IndianRupee,
  Send,
  CheckCircle2,
  Trash2,
  Clock,
} from "lucide-react";
import {
  createBillingMilestone,
  updateBillingMilestoneStatus,
  deleteBillingMilestone,
  type BillingMilestone,
  type BillingMilestoneStatus,
} from "@/lib/queries/billing";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface BillingMilestonesViewProps {
  projectId: string;
  initialMilestones: BillingMilestone[];
  user: { id: string; role: UserRole };
}

const STATUS_BADGES: Record<BillingMilestoneStatus, { label: string; bg: string; text: string }> = {
  pending: { label: "Pending", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  invoiced: { label: "Invoiced", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  paid: { label: "Paid", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
};

const NEXT_STATUS: Partial<Record<BillingMilestoneStatus, BillingMilestoneStatus>> = {
  pending: "invoiced",
  invoiced: "paid",
};

const NEXT_ACTION_LABEL: Partial<Record<BillingMilestoneStatus, string>> = {
  pending: "Mark Invoiced",
  invoiced: "Mark Paid",
};

export function BillingMilestonesView({ projectId, initialMilestones, user }: BillingMilestonesViewProps) {
  const supabase = createClient();
  const [milestones, setMilestones] = useState<BillingMilestone[]>(initialMilestones);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canManage = user.role === "admin" || user.role === "project_manager";

  const totalValue = milestones.reduce((s, m) => s + m.amount, 0);
  const totalPaid = milestones.filter((m) => m.status === "paid").reduce((s, m) => s + m.amount, 0);
  const totalInvoiced = milestones.filter((m) => m.status === "invoiced").reduce((s, m) => s + m.amount, 0);
  const totalPending = milestones.filter((m) => m.status === "pending").reduce((s, m) => s + m.amount, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const numAmount = Number(amount);
    if (!title.trim() || !numAmount || numAmount <= 0) {
      setErrorMsg("Title and a valid amount are required.");
      return;
    }

    setIsSubmitting(true);
    const res = await createBillingMilestone(
      supabase,
      {
        project_id: projectId,
        title: title.trim(),
        description: description.trim() || null,
        amount: numAmount,
        due_date: dueDate || null,
        sequence: milestones.length,
      },
      user.id
    );
    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.error || "Failed to create milestone.");
      return;
    }

    setMilestones((prev) => [...prev, res.data!]);
    setTitle("");
    setDescription("");
    setAmount("");
    setDueDate("");
    setIsAddModalOpen(false);
  };

  const handleAdvanceStatus = async (m: BillingMilestone) => {
    const next = NEXT_STATUS[m.status];
    if (!next) return;
    setUpdatingId(m.id);
    const res = await updateBillingMilestoneStatus(supabase, m.id, next);
    setUpdatingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update milestone.");
      return;
    }

    setMilestones((prev) =>
      prev.map((x) =>
        x.id === m.id
          ? {
              ...x,
              status: next,
              invoiced_at: next === "invoiced" ? new Date().toISOString() : x.invoiced_at,
              paid_at: next === "paid" ? new Date().toISOString() : x.paid_at,
            }
          : x
      )
    );
  };

  const handleDelete = async (id: string) => {
    setUpdatingId(id);
    const res = await deleteBillingMilestone(supabase, id);
    setUpdatingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to delete milestone.");
      return;
    }
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Client Billing & Draw Schedule
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            What&apos;s owed by the client, tracked separately from internal project expenses.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all shrink-0 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Milestone
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Contract Value</p>
          <p className="text-2xl font-bold text-foreground mt-1">₹{totalValue.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Pending</p>
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-400 mt-1">₹{totalPending.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Invoiced (Awaiting Payment)</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">₹{totalInvoiced.toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Paid</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">₹{totalPaid.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <Receipt className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">No billing milestones yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canManage ? 'Click "Add Milestone" to set up the draw schedule (e.g. "30% on foundation completion").' : "No milestones have been set up for this project yet."}
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="divide-y divide-border">
            {milestones.map((m) => {
              const statusCfg = STATUS_BADGES[m.status];
              const next = NEXT_STATUS[m.status];
              return (
                <div key={m.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{m.title}</p>
                      <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full", statusCfg.bg, statusCfg.text)}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {m.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Due {m.due_date}</span>}
                      {m.invoiced_at && <span>Invoiced {new Date(m.invoiced_at).toLocaleDateString("en-IN")}</span>}
                      {m.paid_at && <span>Paid {new Date(m.paid_at).toLocaleDateString("en-IN")}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-base font-bold text-foreground flex items-center">
                      <IndianRupee className="w-3.5 h-3.5" />
                      {m.amount.toLocaleString("en-IN")}
                    </span>
                    {canManage && next && (
                      <button
                        onClick={() => handleAdvanceStatus(m)}
                        disabled={updatingId === m.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-60 transition-all"
                      >
                        {updatingId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : m.status === "pending" ? <Send className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        {NEXT_ACTION_LABEL[m.status]}
                      </button>
                    )}
                    {canManage && m.status === "pending" && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        disabled={updatingId === m.id}
                        className="text-muted-foreground hover:text-rose-500 disabled:opacity-50"
                        title="Delete milestone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" /> Add Billing Milestone
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. 30% on Foundation Completion"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1500000"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional detail visible to the client…"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {errorMsg && <p className="text-[11px] text-rose-500">{errorMsg}</p>}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
                  Add Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
