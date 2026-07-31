"use client";

import { useState } from "react";
import {
  AlertCircle,
  Plus,
  Filter,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Wrench,
  Users,
  ShieldAlert,
  HelpCircle,
  UserCheck,
} from "lucide-react";
import { SubmitGrievanceModal } from "./SubmitGrievanceModal";
import { ResolveGrievanceModal } from "./ResolveGrievanceModal";
import type { GrievanceItem } from "@/lib/queries/grievances";
import type { GrievanceCategory, GrievanceStatus, UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface GrievancesViewProps {
  initialGrievances: GrievanceItem[];
  userId: string;
  userRole: UserRole;
  managers: { id: string; full_name: string | null; email: string }[];
}

const CATEGORY_CONFIG: Record<GrievanceCategory, { label: string; icon: any; bg: string; text: string }> = {
  safety:    { label: "Safety Hazard",  icon: ShieldAlert, bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
  equipment: { label: "Equipment",      icon: Wrench,      bg: "bg-violet-100 dark:bg-violet-950/60", text: "text-violet-800 dark:text-violet-300" },
  hr:        { label: "HR / Payroll",   icon: Users,       bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  other:     { label: "General Issue",  icon: HelpCircle,  bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-700 dark:text-slate-300" },
};

const STATUS_CONFIG: Record<GrievanceStatus, { label: string; bg: string; text: string }> = {
  open:        { label: "Open Review",  bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  in_progress: { label: "In Progress",  bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  resolved:    { label: "Resolved",     bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  closed:      { label: "Closed",       bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-700 dark:text-slate-300" },
};

export function GrievancesView({
  initialGrievances,
  userId,
  userRole,
  managers,
}: GrievancesViewProps) {
  const isManager = userRole === "admin" || userRole === "project_manager";

  const [grievances, setGrievances] = useState<GrievanceItem[]>(initialGrievances);
  const [activeTab, setActiveTab] = useState<"all" | "my">(isManager ? "all" : "my");

  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [grievanceToResolve, setGrievanceToResolve] = useState<GrievanceItem | null>(null);

  // Filter logic
  const filteredGrievances = grievances.filter((g) => {
    const matchesTab = activeTab === "all" || g.submitted_by === userId;
    const matchesCategory = categoryFilter === "all" || g.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || g.status === statusFilter;
    return matchesTab && matchesCategory && matchesStatus;
  });

  const handleGrievanceSubmitted = (newGrievance: GrievanceItem) => {
    setGrievances((prev) => [newGrievance, ...prev]);
  };

  const handleGrievanceResolved = (updated: GrievanceItem) => {
    setGrievances((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            Grievances & Issue Reporting
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Submit site hazards, safety violations, equipment issues, or HR concerns.
          </p>
        </div>

        <button
          onClick={() => setShowSubmitModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Report an Issue
        </button>
      </div>

      {/* Filter & Sub-Tab Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        {/* Manager Sub-tabs */}
        {isManager ? (
          <div className="flex bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
              All Submissions ({grievances.length})
            </button>

            <button
              onClick={() => setActiveTab("my")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "my"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              My Submissions ({grievances.filter((g) => g.submitted_by === userId).length})
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-muted-foreground">
            Showing issues reported by you ({filteredGrievances.length})
          </div>
        )}

        {/* Category & Status Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              <option value="safety">Safety Hazards</option>
              <option value="equipment">Equipment</option>
              <option value="hr">HR & Payroll</option>
              <option value="other">Other Issues</option>
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open Review</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Issues Grid Cards */}
      <div className="space-y-4">
        {filteredGrievances.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground shadow-sm">
            <AlertCircle className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-semibold text-foreground">No grievances found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click "Report an Issue" to log site hazards or working condition concerns.
            </p>
          </div>
        ) : (
          filteredGrievances.map((g) => {
            const catCfg = CATEGORY_CONFIG[g.category] || CATEGORY_CONFIG.other;
            const statusCfg = STATUS_CONFIG[g.status] || STATUS_CONFIG.open;
            const CategoryIcon = catCfg.icon;

            return (
              <div
                key={g.id}
                className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4 hover:border-border/80 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold",
                          catCfg.bg,
                          catCfg.text
                        )}
                      >
                        <CategoryIcon className="w-3.5 h-3.5" />
                        {catCfg.label}
                      </span>

                      <span
                        className={cn(
                          "inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold",
                          statusCfg.bg,
                          statusCfg.text
                        )}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground pt-1">{g.title}</h3>
                  </div>

                  {/* Manager Action Button */}
                  {isManager && (
                    <button
                      onClick={() => setGrievanceToResolve(g)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/80 transition-all border border-indigo-200 dark:border-indigo-800 shrink-0 self-start"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      Action / Resolve
                    </button>
                  )}
                </div>

                {/* Description Body */}
                <p className="text-xs text-foreground/90 whitespace-pre-line bg-secondary/30 p-3 rounded-xl border border-border/60">
                  {g.description}
                </p>

                {/* Resolution Notes Display (if present) */}
                {g.resolution_notes && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Resolution Notes:
                    </p>
                    <p className="text-xs text-emerald-900 dark:text-emerald-200">
                      {g.resolution_notes}
                    </p>
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border/60 pt-3">
                  <div className="flex items-center gap-4">
                    <span>
                      Submitted by:{" "}
                      <strong className="text-foreground font-medium">
                        {g.submitter?.full_name || g.submitter?.email || "User"}
                      </strong>
                    </span>

                    <span>
                      Date:{" "}
                      {new Date(g.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>
                      Assignee:{" "}
                      <strong className="text-foreground font-medium">
                        {g.assignee?.full_name || g.assignee?.email || "Unassigned"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Submit Issue Modal */}
      <SubmitGrievanceModal
        isOpen={showSubmitModal}
        userId={userId}
        onClose={() => setShowSubmitModal(false)}
        onSuccess={handleGrievanceSubmitted}
      />

      {/* Resolve Issue Modal (Admin/PM) */}
      <ResolveGrievanceModal
        grievance={grievanceToResolve}
        isOpen={!!grievanceToResolve}
        userId={userId}
        managers={managers}
        onClose={() => setGrievanceToResolve(null)}
        onSuccess={handleGrievanceResolved}
      />
    </div>
  );
}
