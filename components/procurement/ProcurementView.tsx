"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShoppingCart,
  Plus,
  Search,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  Building2,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updatePurchaseOrderStatus } from "@/lib/queries/procurement";
import type { PurchaseOrderWithDetails, Vendor, PoStatus } from "@/lib/queries/procurement";
import type { UserRole } from "@/types/database";
import { CreatePOModal } from "./CreatePOModal";
import { CreateVendorModal } from "./CreateVendorModal";

interface ProcurementViewProps {
  purchaseOrders: PurchaseOrderWithDetails[];
  vendors: Vendor[];
  projects: { id: string; name: string }[];
  user: { id: string; role: UserRole };
}

const STATUS_BADGES: Record<PoStatus, { label: string; bg: string; text: string }> = {
  draft: { label: "Draft", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  pending_approval: { label: "Pending Approval", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  approved: { label: "Approved", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  rejected: { label: "Rejected", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
  ordered: { label: "Ordered", bg: "bg-blue-100 dark:bg-blue-950/60", text: "text-blue-800 dark:text-blue-300" },
  partially_received: { label: "Partially Received", bg: "bg-cyan-100 dark:bg-cyan-950/60", text: "text-cyan-800 dark:text-cyan-300" },
  received: { label: "Received", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-400" },
};

const NEXT_STATUS: Partial<Record<PoStatus, PoStatus>> = {
  draft: "pending_approval",
  pending_approval: "approved",
  approved: "ordered",
  ordered: "received",
};

export function ProcurementView({ purchaseOrders, vendors, projects, user }: ProcurementViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"orders" | "vendors">("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canManage = user.role === "admin" || user.role === "project_manager";

  const filteredPOs = purchaseOrders.filter((po) => {
    const matchesSearch =
      po.po_number.toLowerCase().includes(search.toLowerCase()) ||
      (po.vendor_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (po.project_name || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredVendors = vendors.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = purchaseOrders.reduce((sum, po) => sum + po.total_amount, 0);
  const pendingCount = purchaseOrders.filter((po) => po.status === "pending_approval").length;
  const receivedCount = purchaseOrders.filter((po) => po.status === "received").length;

  function refresh() {
    router.refresh();
  }

  async function handleAdvanceStatus(po: PurchaseOrderWithDetails) {
    const next = NEXT_STATUS[po.status];
    if (!next) return;
    setUpdatingId(po.id);
    await updatePurchaseOrderStatus(supabase, po.id, next, next === "approved" ? user.id : undefined);
    setUpdatingId(null);
    refresh();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Procurement
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage vendors, purchase orders, and material procurement across projects.
          </p>
        </div>

        {canManage && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setIsVendorModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-indigo-500/50 text-foreground font-medium rounded-xl text-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Vendor
            </button>
            <button
              onClick={() => setIsPoModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Orders</p>
            <p className="text-lg font-bold text-foreground">{purchaseOrders.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Pending Approval</p>
            <p className="text-lg font-bold text-foreground">{pendingCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Received</p>
            <p className="text-lg font-bold text-foreground">{receivedCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950/60 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total PO Value</p>
            <p className="text-lg font-bold text-foreground">₹{totalValue.toLocaleString("en-IN")}</p>
          </div>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs shrink-0">
          <button
            onClick={() => setTab("orders")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all",
              tab === "orders" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Purchase Orders
          </button>
          <button
            onClick={() => setTab("vendors")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all",
              tab === "vendors" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Vendors
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "orders" ? "Search PO number, vendor, project..." : "Search vendors..."}
            className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {tab === "orders" && (
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
        )}
      </div>

      {/* Content */}
      {tab === "orders" ? (
        filteredPOs.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No Purchase Orders Found</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {canManage ? "Create your first purchase order to start tracking procurement." : "No purchase orders match your search."}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">PO Number</th>
                    <th className="text-left font-medium px-4 py-3">Vendor</th>
                    <th className="text-left font-medium px-4 py-3">Project</th>
                    <th className="text-left font-medium px-4 py-3">Status</th>
                    <th className="text-right font-medium px-4 py-3">Total</th>
                    <th className="text-left font-medium px-4 py-3">Expected Delivery</th>
                    {canManage && <th className="text-right font-medium px-4 py-3">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredPOs.map((po) => {
                    const statusCfg = STATUS_BADGES[po.status];
                    const next = NEXT_STATUS[po.status];
                    return (
                      <tr key={po.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-semibold text-foreground">{po.po_number}</td>
                        <td className="px-4 py-3 text-foreground">{po.vendor_name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{po.project_name || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-lg", statusCfg.bg, statusCfg.text)}>
                            {statusCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-foreground">
                          ₹{po.total_amount.toLocaleString("en-IN")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {po.expected_delivery_date || "—"}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3 text-right">
                            {next && (
                              <button
                                onClick={() => handleAdvanceStatus(po)}
                                disabled={updatingId === po.id}
                                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50"
                              >
                                Mark as {STATUS_BADGES[next].label}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredVendors.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Building2 className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Vendors Found</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {canManage ? "Add your first vendor to start creating purchase orders." : "No vendors match your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-card border border-border hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 capitalize">
                  {vendor.vendor_type}
                </span>
                {vendor.rating != null && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <Star className="w-3.5 h-3.5 fill-current" /> {vendor.rating.toFixed(1)}
                  </span>
                )}
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">{vendor.name}</h3>
              <div className="space-y-1 text-xs text-muted-foreground">
                {vendor.contact_name && <p>{vendor.contact_name}</p>}
                {vendor.phone && <p>{vendor.phone}</p>}
                {vendor.email && <p className="truncate">{vendor.email}</p>}
              </div>
              <div className="mt-3 pt-3 border-t border-border/60">
                <span
                  className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-lg capitalize",
                    vendor.status === "active"
                      ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                      : vendor.status === "blacklisted"
                      ? "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                  )}
                >
                  {vendor.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreatePOModal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
        userId={user.id}
        projects={projects}
        vendors={vendors.filter((v) => v.vendor_type !== "subcontractor")}
        onCreated={refresh}
      />
      <CreateVendorModal
        isOpen={isVendorModalOpen}
        onClose={() => setIsVendorModalOpen(false)}
        userId={user.id}
        onCreated={refresh}
      />
    </div>
  );
}
