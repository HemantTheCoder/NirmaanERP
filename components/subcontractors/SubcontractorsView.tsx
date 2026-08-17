"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HardHat,
  Plus,
  Search,
  FileSignature,
  CheckCircle2,
  Clock,
  IndianRupee,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateSubcontractStatus } from "@/lib/queries/subcontractors";
import type { SubcontractWithDetails, SubcontractStatus } from "@/lib/queries/subcontractors";
import type { Vendor } from "@/lib/queries/procurement";
import type { UserRole } from "@/types/database";
import { CreateSubcontractModal } from "./CreateSubcontractModal";
import { AddReviewModal } from "./AddReviewModal";

interface SubcontractorsViewProps {
  subcontracts: SubcontractWithDetails[];
  vendors: Vendor[];
  projects: { id: string; name: string }[];
  user: { id: string; role: UserRole };
}

const STATUS_BADGES: Record<SubcontractStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  active: { label: "Active", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  completed: { label: "Completed", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  terminated: { label: "Terminated", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

const NEXT_STATUS: Partial<Record<SubcontractStatus, SubcontractStatus>> = {
  draft: "active",
  active: "completed",
};

export function SubcontractorsView({ subcontracts, vendors, projects, user }: SubcontractorsViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState<SubcontractWithDetails | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canManage = user.role === "admin" || user.role === "project_manager";
  const subVendors = vendors.filter((v) => v.vendor_type === "subcontractor" || v.vendor_type === "both");

  const filtered = subcontracts.filter((sc) => {
    const matchesSearch =
      sc.contract_number.toLowerCase().includes(search.toLowerCase()) ||
      (sc.vendor_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (sc.project_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || sc.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalValue = subcontracts.reduce((sum, sc) => sum + sc.contract_value, 0);
  const activeCount = subcontracts.filter((sc) => sc.status === "active").length;
  const completedCount = subcontracts.filter((sc) => sc.status === "completed").length;

  function refresh() {
    router.refresh();
  }

  async function handleAdvanceStatus(sc: SubcontractWithDetails) {
    const next = NEXT_STATUS[sc.status];
    if (!next) return;
    setUpdatingId(sc.id);
    await updateSubcontractStatus(supabase, sc.id, next);
    setUpdatingId(null);
    refresh();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <HardHat className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Subcontractor Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track subcontracts, scope of work, and performance ratings across projects.
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Subcontract
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileSignature className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Contracts</p>
            <p className="text-lg font-bold text-foreground">{subcontracts.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Active</p>
            <p className="text-lg font-bold text-foreground">{activeCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Completed</p>
            <p className="text-lg font-bold text-foreground">{completedCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Contract Value</p>
            <p className="text-lg font-bold text-foreground">₹{totalValue.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contract number, vendor, project..."
            className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_BADGES).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <HardHat className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Subcontracts Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {canManage ? "Create your first subcontract to start tracking scope and performance." : "No subcontracts match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filtered.map((sc) => {
            const statusCfg = STATUS_BADGES[sc.status];
            const next = NEXT_STATUS[sc.status];
            return (
              <div key={sc.id} className="bg-card border border-border hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                    {sc.contract_number}
                  </span>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-lg", statusCfg.bg, statusCfg.text)}>
                    {statusCfg.label}
                  </span>
                </div>

                <h3 className="text-base font-bold text-foreground mb-1">{sc.vendor_name}</h3>
                <p className="text-xs text-muted-foreground mb-3">{sc.project_name}</p>
                <p className="text-xs text-foreground line-clamp-2 mb-3">{sc.scope_of_work}</p>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2.5 bg-muted/40 rounded-xl">
                  <div>
                    <span className="text-muted-foreground text-[11px]">Contract Value</span>
                    <p className="font-bold text-foreground">₹{sc.contract_value.toLocaleString("en-IN")}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Retention</span>
                    <p className="font-bold text-foreground">{sc.retention_percentage}%</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <div className="flex items-center gap-1">
                    {sc.avg_rating != null ? (
                      <>
                        <Star className="w-3.5 h-3.5 fill-current text-amber-400" />
                        <span className="text-xs font-semibold text-foreground">{sc.avg_rating.toFixed(1)}</span>
                        <span className="text-[11px] text-muted-foreground">({sc.review_count} review{sc.review_count === 1 ? "" : "s"})</span>
                      </>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No reviews yet</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {canManage && (
                      <button
                        onClick={() => setReviewTarget(sc)}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                      >
                        Rate Performance
                      </button>
                    )}
                    {canManage && next && (
                      <button
                        onClick={() => handleAdvanceStatus(sc)}
                        disabled={updatingId === sc.id}
                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 disabled:opacity-50"
                      >
                        Mark {STATUS_BADGES[next].label}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateSubcontractModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userId={user.id}
        projects={projects}
        vendors={subVendors}
        onCreated={refresh}
      />

      {reviewTarget && (
        <AddReviewModal
          isOpen={!!reviewTarget}
          onClose={() => setReviewTarget(null)}
          userId={user.id}
          subcontractId={reviewTarget.id}
          vendorId={reviewTarget.vendor_id}
          projectId={reviewTarget.project_id}
          vendorName={reviewTarget.vendor_name || "Vendor"}
          onCreated={refresh}
        />
      )}
    </div>
  );
}
