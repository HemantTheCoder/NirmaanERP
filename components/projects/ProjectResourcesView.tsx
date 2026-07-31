"use client";

import { useState } from "react";
import {
  Package,
  Plus,
  Filter,
  Check,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  X,
  Layers,
  Wrench,
  Users,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  updateResourceStatus,
  type ResourceAllocationItem,
} from "@/lib/queries/resources";
import { RequestResourceModal } from "./RequestResourceModal";
import type { ResourceType, ResourceStatus, UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProjectResourcesViewProps {
  initialResources: ResourceAllocationItem[];
  projectId: string;
  userId: string;
  userRole: UserRole;
}

const CATEGORY_CONFIG: Record<ResourceType, { label: string; icon: any; bg: string; text: string }> = {
  material:  { label: "Material",  icon: Layers, bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  equipment: { label: "Equipment", icon: Wrench, bg: "bg-violet-100 dark:bg-violet-950/60", text: "text-violet-800 dark:text-violet-300" },
  labor:     { label: "Labor",     icon: Users,  bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
};

const STATUS_CONFIG: Record<ResourceStatus, { label: string; bg: string; text: string }> = {
  requested: { label: "Requested", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  approved:  { label: "Approved",  bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  in_use:    { label: "In Use",    bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  released:  { label: "Released",  bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-700 dark:text-slate-300" },
  rejected:  { label: "Rejected",  bg: "bg-rose-100 dark:bg-rose-950/60",     text: "text-rose-800 dark:text-rose-300" },
};

export function ProjectResourcesView({
  initialResources,
  projectId,
  userId,
  userRole,
}: ProjectResourcesViewProps) {
  const supabase = createClient();

  const [resources, setResources] = useState<ResourceAllocationItem[]>(initialResources);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showModal, setShowModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canManageStatus = userRole === "admin" || userRole === "project_manager";

  // Filtered resources
  const filteredResources = resources.filter((r) => {
    const matchesCategory = categoryFilter === "all" || r.resource_type === categoryFilter;
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesCategory && matchesStatus;
  });

  const handleAction = async (resource: ResourceAllocationItem, nextStatus: ResourceStatus) => {
    setActionLoadingId(resource.id);
    setErrorMsg(null);

    const res = await updateResourceStatus(supabase, {
      resourceId: resource.id,
      status: nextStatus,
      approvedBy: userId,
    });

    setActionLoadingId(null);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update resource status.");
    } else {
      setResources((prev) =>
        prev.map((r) =>
          r.id === resource.id
            ? { ...r, status: nextStatus, approved_by: userId }
            : r
        )
      );
    }
  };

  const handleSuccess = (newResource: ResourceAllocationItem) => {
    setResources((prev) => [newResource, ...prev]);
  };

  return (
    <div className="space-y-6">
      {/* Global Error Banner */}
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

      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              <option value="material">Materials</option>
              <option value="equipment">Equipment</option>
              <option value="labor">Labor</option>
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="in_use">In Use</option>
            <option value="released">Released</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        {/* Request Resource Button */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Request Resource
        </button>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Resource Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Quantity & Unit</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Requested By</th>
                <th className="px-5 py-3.5">Date</th>
                {canManageStatus && <th className="px-5 py-3.5 text-right">Workflow Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredResources.length === 0 ? (
                <tr>
                  <td colSpan={canManageStatus ? 7 : 6} className="text-center py-10 text-muted-foreground">
                    No resource allocations found for this project.
                  </td>
                </tr>
              ) : (
                filteredResources.map((r) => {
                  const catCfg = CATEGORY_CONFIG[r.resource_type] || CATEGORY_CONFIG.material;
                  const statusCfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.requested;
                  const Icon = catCfg.icon;

                  return (
                    <tr key={r.id} className="hover:bg-muted/40 transition-colors">
                      {/* Name & Notes */}
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{r.resource_name}</p>
                        {r.notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 max-w-xs truncate">
                            {r.notes}
                          </p>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold",
                            catCfg.bg,
                            catCfg.text
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {catCfg.label}
                        </span>
                      </td>

                      {/* Quantity & Unit */}
                      <td className="px-5 py-3.5 font-bold text-foreground">
                        {r.quantity} <span className="font-normal text-muted-foreground text-[11px]">{r.unit}</span>
                      </td>

                      {/* Status Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-block px-2.5 py-1 rounded-md text-xs font-semibold",
                            statusCfg.bg,
                            statusCfg.text
                          )}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* Requested By */}
                      <td className="px-5 py-3.5 text-muted-foreground font-medium">
                        {r.requester?.full_name || r.requester?.email || "User"}
                      </td>

                      {/* Requested Date */}
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(r.requested_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions (Admin/PM only) */}
                      {canManageStatus && (
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Requested -> Approve or Reject */}
                            {r.status === "requested" && (
                              <>
                                <button
                                  onClick={() => handleAction(r, "approved")}
                                  disabled={actionLoadingId === r.id}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs"
                                  title="Approve Resource Request"
                                >
                                  {actionLoadingId === r.id ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  Approve
                                </button>

                                <button
                                  onClick={() => handleAction(r, "rejected")}
                                  disabled={actionLoadingId === r.id}
                                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all"
                                  title="Reject Resource Request"
                                >
                                  <X className="w-3 h-3" />
                                  Reject
                                </button>
                              </>
                            )}

                            {/* Approved -> Mark In-Use */}
                            {r.status === "approved" && (
                              <button
                                onClick={() => handleAction(r, "in_use")}
                                disabled={actionLoadingId === r.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xs"
                                title="Mark Resource as In Use"
                              >
                                {actionLoadingId === r.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Play className="w-3 h-3" />
                                )}
                                Mark In-Use
                              </button>
                            )}

                            {/* In-Use -> Release */}
                            {r.status === "in_use" && (
                              <button
                                onClick={() => handleAction(r, "released")}
                                disabled={actionLoadingId === r.id}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md bg-slate-700 text-white hover:bg-slate-800 transition-all shadow-xs"
                                title="Release Resource back to Pool"
                              >
                                {actionLoadingId === r.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3 h-3" />
                                )}
                                Release
                              </button>
                            )}

                            {/* Released or Rejected: Completed states */}
                            {(r.status === "released" || r.status === "rejected") && (
                              <span className="text-[11px] text-muted-foreground font-normal italic">
                                Completed
                              </span>
                            )}
                          </div>
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

      {/* Request Resource Modal */}
      <RequestResourceModal
        isOpen={showModal}
        projectId={projectId}
        userId={userId}
        onClose={() => setShowModal(false)}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
