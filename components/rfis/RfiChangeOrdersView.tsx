"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquareText,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  FileEdit,
  IndianRupee,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateRfiStatus, updateChangeOrderStatus } from "@/lib/queries/rfis";
import type { RfiWithDetails, ChangeOrderWithDetails, RfiStatus, ChangeOrderStatus } from "@/lib/queries/rfis";
import type { UserRole } from "@/types/database";
import { CreateRfiModal } from "./CreateRfiModal";
import { RespondRfiModal } from "./RespondRfiModal";
import { CreateChangeOrderModal } from "./CreateChangeOrderModal";

interface RfiChangeOrdersViewProps {
  rfis: RfiWithDetails[];
  changeOrders: ChangeOrderWithDetails[];
  projects: { id: string; name: string }[];
  teamMembers: { id: string; full_name: string }[];
  user: { id: string; role: UserRole };
}

const RFI_STATUS_BADGES: Record<RfiStatus, { label: string; bg: string; text: string }> = {
  open: { label: "Open", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  answered: { label: "Answered", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  closed: { label: "Closed", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
};

const PRIORITY_BADGES: Record<string, string> = {
  low: "text-slate-600 dark:text-slate-400",
  medium: "text-blue-600 dark:text-blue-400",
  high: "text-amber-600 dark:text-amber-400",
  urgent: "text-rose-600 dark:text-rose-400",
};

const CO_STATUS_BADGES: Record<ChangeOrderStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  pending_approval: { label: "Pending Approval", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  approved: { label: "Approved", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  rejected: { label: "Rejected", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
  implemented: { label: "Implemented", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
};

const NEXT_CO_STATUS: Partial<Record<ChangeOrderStatus, ChangeOrderStatus>> = {
  draft: "pending_approval",
  pending_approval: "approved",
  approved: "implemented",
};

export function RfiChangeOrdersView({ rfis, changeOrders, projects, teamMembers, user }: RfiChangeOrdersViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"rfis" | "change_orders">("rfis");
  const [search, setSearch] = useState("");
  const [isRfiModalOpen, setIsRfiModalOpen] = useState(false);
  const [isCoModalOpen, setIsCoModalOpen] = useState(false);
  const [respondTarget, setRespondTarget] = useState<RfiWithDetails | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canManage = user.role === "admin" || user.role === "project_manager";
  const canRaiseRfi = canManage || user.role === "site_staff";

  const filteredRfis = rfis.filter(
    (r) =>
      r.rfi_number.toLowerCase().includes(search.toLowerCase()) ||
      r.subject.toLowerCase().includes(search.toLowerCase()) ||
      (r.project_name || "").toLowerCase().includes(search.toLowerCase())
  );
  const filteredCOs = changeOrders.filter(
    (c) =>
      c.co_number.toLowerCase().includes(search.toLowerCase()) ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      (c.project_name || "").toLowerCase().includes(search.toLowerCase())
  );

  const openRfiCount = rfis.filter((r) => r.status === "open").length;
  const pendingCoCount = changeOrders.filter((c) => c.status === "pending_approval").length;
  const totalCostImpact = changeOrders
    .filter((c) => c.status === "approved" || c.status === "implemented")
    .reduce((sum, c) => sum + c.cost_impact, 0);

  function refresh() {
    router.refresh();
  }

  async function handleCloseRfi(rfi: RfiWithDetails) {
    setUpdatingId(rfi.id);
    await updateRfiStatus(supabase, rfi.id, "closed");
    setUpdatingId(null);
    refresh();
  }

  async function handleAdvanceCo(co: ChangeOrderWithDetails) {
    const next = NEXT_CO_STATUS[co.status];
    if (!next) return;
    setUpdatingId(co.id);
    await updateChangeOrderStatus(supabase, co.id, next, next === "approved" ? user.id : undefined);
    setUpdatingId(null);
    refresh();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <MessageSquareText className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            RFIs & Change Orders
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track formal information requests and cost/schedule-impacting change orders.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          {tab === "rfis" && canRaiseRfi && (
            <button
              onClick={() => setIsRfiModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              New RFI
            </button>
          )}
          {tab === "change_orders" && canManage && (
            <button
              onClick={() => setIsCoModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Change Order
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Open RFIs</p>
            <p className="text-lg font-bold text-foreground">{openRfiCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <FileEdit className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Change Orders</p>
            <p className="text-lg font-bold text-foreground">{changeOrders.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Pending Approval</p>
            <p className="text-lg font-bold text-foreground">{pendingCoCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <IndianRupee className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Approved Cost Impact</p>
            <p className="text-lg font-bold text-foreground">₹{totalCostImpact.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs shrink-0">
          <button
            onClick={() => setTab("rfis")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all",
              tab === "rfis" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            RFIs
          </button>
          <button
            onClick={() => setTab("change_orders")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all",
              tab === "change_orders" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Change Orders
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Content */}
      {tab === "rfis" ? (
        filteredRfis.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <MessageSquareText className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No RFIs Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {canRaiseRfi ? "Raise your first request for information." : "No RFIs match your search."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRfis.map((rfi) => {
              const statusCfg = RFI_STATUS_BADGES[rfi.status];
              const canRespond = canManage || rfi.assigned_to === user.id;
              return (
                <div key={rfi.id} className="bg-card border border-border hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                        {rfi.rfi_number}
                      </span>
                      <span className={cn("text-[11px] font-bold uppercase", PRIORITY_BADGES[rfi.priority])}>
                        {rfi.priority}
                      </span>
                    </div>
                    <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-lg shrink-0", statusCfg.bg, statusCfg.text)}>
                      {statusCfg.label}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground mb-1">{rfi.subject}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{rfi.project_name}</p>
                  <p className="text-sm text-foreground mb-3">{rfi.question}</p>

                  {rfi.response && (
                    <div className="p-3 bg-muted/40 rounded-xl mb-3 text-sm">
                      <p className="text-[11px] text-muted-foreground font-semibold mb-1">Response:</p>
                      <p className="text-foreground">{rfi.response}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t border-border/60 text-[11px] text-muted-foreground">
                    <span>
                      Raised by {rfi.raised_by_name}
                      {rfi.assigned_to_name && ` · Assigned to ${rfi.assigned_to_name}`}
                      {rfi.due_date && ` · Due ${rfi.due_date}`}
                    </span>
                    <div className="flex items-center gap-3">
                      {rfi.status === "open" && canRespond && (
                        <button
                          onClick={() => setRespondTarget(rfi)}
                          className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
                        >
                          Respond
                        </button>
                      )}
                      {rfi.status === "answered" && canManage && (
                        <button
                          onClick={() => handleCloseRfi(rfi)}
                          disabled={updatingId === rfi.id}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 disabled:opacity-50"
                        >
                          Close RFI
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : filteredCOs.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <FileEdit className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Change Orders Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {canManage ? "Create your first change order to track cost and schedule impact." : "No change orders match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCOs.map((co) => {
            const statusCfg = CO_STATUS_BADGES[co.status];
            const next = NEXT_CO_STATUS[co.status];
            return (
              <div key={co.id} className="bg-card border border-border hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                    {co.co_number}
                  </span>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-lg", statusCfg.bg, statusCfg.text)}>
                    {statusCfg.label}
                  </span>
                </div>

                <h3 className="text-base font-bold text-foreground mb-1">{co.title}</h3>
                <p className="text-xs text-muted-foreground mb-3">{co.project_name}</p>
                <p className="text-sm text-foreground line-clamp-2 mb-3">{co.description}</p>

                <div className="grid grid-cols-2 gap-2 text-xs mb-3 p-2.5 bg-muted/40 rounded-xl">
                  <div>
                    <span className="text-muted-foreground text-[11px]">Cost Impact</span>
                    <p className={cn("font-bold", co.cost_impact < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground")}>
                      {co.cost_impact < 0 ? "-" : ""}₹{Math.abs(co.cost_impact).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px]">Schedule Impact</span>
                    <p className="font-bold text-foreground">{co.schedule_impact_days} day{co.schedule_impact_days === 1 ? "" : "s"}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border/60">
                  <span className="text-[11px] text-muted-foreground">Requested by {co.requested_by_name}</span>
                  {canManage && next && (
                    <button
                      onClick={() => handleAdvanceCo(co)}
                      disabled={updatingId === co.id}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50"
                    >
                      Mark {CO_STATUS_BADGES[next].label}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <CreateRfiModal
        isOpen={isRfiModalOpen}
        onClose={() => setIsRfiModalOpen(false)}
        userId={user.id}
        projects={projects}
        teamMembers={teamMembers}
        onCreated={refresh}
      />
      <CreateChangeOrderModal
        isOpen={isCoModalOpen}
        onClose={() => setIsCoModalOpen(false)}
        userId={user.id}
        projects={projects}
        onCreated={refresh}
      />
      {respondTarget && (
        <RespondRfiModal
          isOpen={!!respondTarget}
          onClose={() => setRespondTarget(null)}
          rfiId={respondTarget.id}
          subject={respondTarget.subject}
          onResponded={refresh}
        />
      )}
    </div>
  );
}
