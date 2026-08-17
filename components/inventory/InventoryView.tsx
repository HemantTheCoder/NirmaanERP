"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Plus,
  Search,
  AlertTriangle,
  Package,
  Wrench,
  Truck,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { updateEquipmentStatus } from "@/lib/queries/inventory";
import type {
  InventoryItem,
  EquipmentAsset,
  EquipmentStatus,
} from "@/lib/queries/inventory";
import type { UserRole } from "@/types/database";
import { CreateInventoryItemModal } from "./CreateInventoryItemModal";
import { RecordTransactionModal } from "./RecordTransactionModal";
import { CreateEquipmentModal } from "./CreateEquipmentModal";
import { PrintExportButton } from "@/components/common/PrintExportButton";

interface InventoryViewProps {
  items: InventoryItem[];
  equipment: EquipmentAsset[];
  projects: { id: string; name: string }[];
  user: { id: string; role: UserRole };
}

const EQUIPMENT_STATUS_BADGES: Record<EquipmentStatus, { label: string; bg: string; text: string }> = {
  available: { label: "Available", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  in_use: { label: "In Use", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  maintenance: { label: "Maintenance", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  retired: { label: "Retired", bg: "bg-slate-200 dark:bg-slate-700", text: "text-slate-600 dark:text-slate-400" },
};

export function InventoryView({ items, equipment, projects, user }: InventoryViewProps) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<"materials" | "equipment">("materials");
  const [search, setSearch] = useState("");
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);
  const [isEquipModalOpen, setIsEquipModalOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const canManage = user.role === "admin" || user.role === "project_manager";
  const canTransact = canManage || user.role === "site_staff";

  const filteredItems = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()));
  const filteredEquipment = equipment.filter((e) => e.name.toLowerCase().includes(search.toLowerCase()));

  const lowStockCount = items.filter((i) => i.quantity_on_hand <= i.reorder_level).length;
  const availableEquipCount = equipment.filter((e) => e.status === "available").length;
  const inUseEquipCount = equipment.filter((e) => e.status === "in_use").length;

  function refresh() {
    router.refresh();
  }

  async function handleEquipmentStatusChange(eq: EquipmentAsset, status: EquipmentStatus) {
    setUpdatingId(eq.id);
    await updateEquipmentStatus(supabase, eq.id, status);
    setUpdatingId(null);
    refresh();
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Boxes className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            Inventory & Equipment
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track material stock levels, receipts/issues, and machinery allocation.
          </p>
        </div>

        <div className="flex gap-2 shrink-0">
          <PrintExportButton reportTitle="Inventory & Equipment Report" />
          {tab === "materials" && canTransact && (
            <>
              {canManage && (
                <button
                  onClick={() => setIsItemModalOpen(true)}
                  className="no-print inline-flex items-center gap-2 px-4 py-2.5 bg-card border border-border hover:border-indigo-500/50 text-foreground font-medium rounded-xl text-xs transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              )}
              <button
                onClick={() => setIsTxnModalOpen(true)}
                className="no-print inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
              >
                <ArrowUpDown className="w-4 h-4" />
                Record Transaction
              </button>
            </>
          )}
          {tab === "equipment" && canManage && (
            <button
              onClick={() => setIsEquipModalOpen(true)}
              className="no-print inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Equipment
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 print-card">
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Stock Items</p>
            <p className="text-lg font-bold text-foreground">{items.length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Low Stock Alerts</p>
            <p className="text-lg font-bold text-foreground">{lowStockCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Equipment Available</p>
            <p className="text-lg font-bold text-foreground">{availableEquipCount}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Equipment In Use</p>
            <p className="text-lg font-bold text-foreground">{inUseEquipCount}</p>
          </div>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="no-print bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50 text-xs shrink-0">
          <button
            onClick={() => setTab("materials")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all",
              tab === "materials" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Materials & Stock
          </button>
          <button
            onClick={() => setTab("equipment")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-semibold transition-all",
              tab === "equipment" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Equipment
          </button>
        </div>

        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "materials" ? "Search inventory items..." : "Search equipment..."}
            className="w-full pl-9 pr-3.5 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Content */}
      {tab === "materials" ? (
        filteredItems.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
            <Package className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-bold text-foreground">No Inventory Items</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              {canManage ? "Add your first inventory item to start tracking stock." : "No items match your search."}
            </p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left font-medium px-4 py-3">Item</th>
                    <th className="text-left font-medium px-4 py-3">Category</th>
                    <th className="text-left font-medium px-4 py-3">Project</th>
                    <th className="text-right font-medium px-4 py-3">Stock on Hand</th>
                    <th className="text-right font-medium px-4 py-3">Reorder Level</th>
                    <th className="text-right font-medium px-4 py-3">Unit Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredItems.map((item) => {
                    const isLow = item.quantity_on_hand <= item.reorder_level;
                    return (
                      <tr key={item.id} className={cn("hover:bg-muted/20 transition-colors", isLow && "bg-rose-50/40 dark:bg-rose-950/10")}>
                        <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                        <td className="px-4 py-3 text-muted-foreground capitalize">{item.category}</td>
                        <td className="px-4 py-3 text-muted-foreground">{item.project_name || "Central Warehouse"}</td>
                        <td className={cn("px-4 py-3 text-right font-medium", isLow ? "text-rose-600 dark:text-rose-400" : "text-foreground")}>
                          {item.quantity_on_hand.toLocaleString("en-IN")} {item.unit}
                          {isLow && <AlertTriangle className="w-3.5 h-3.5 inline-block ml-1.5 -mt-0.5" />}
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{item.reorder_level.toLocaleString("en-IN")} {item.unit}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{item.unit_cost != null ? `₹${item.unit_cost.toLocaleString("en-IN")}` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredEquipment.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <Truck className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <h3 className="text-base font-bold text-foreground">No Equipment Assets</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm">
            {canManage ? "Add your first equipment asset to start tracking machinery." : "No equipment matches your search."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 print-card">
          {filteredEquipment.map((eq) => {
            const statusCfg = EQUIPMENT_STATUS_BADGES[eq.status];
            return (
              <div key={eq.id} className="bg-card border border-border hover:border-indigo-500/50 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2.5 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-900/50 capitalize">
                    {eq.category}
                  </span>
                  <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-lg", statusCfg.bg, statusCfg.text)}>
                    {statusCfg.label}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-1">{eq.name}</h3>
                {eq.asset_tag && <p className="text-xs text-muted-foreground mb-2">Tag: {eq.asset_tag}</p>}
                <p className="text-xs text-muted-foreground mb-3">
                  {eq.current_project_name ? `Assigned: ${eq.current_project_name}` : "Unassigned"}
                </p>

                {canManage && (
                  <div className="pt-3 border-t border-border/60 flex flex-wrap gap-2">
                    {(["available", "in_use", "maintenance", "retired"] as EquipmentStatus[])
                      .filter((s) => s !== eq.status)
                      .map((s) => (
                        <button
                          key={s}
                          onClick={() => handleEquipmentStatusChange(eq, s)}
                          disabled={updatingId === eq.id}
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50"
                        >
                          Mark {EQUIPMENT_STATUS_BADGES[s].label}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CreateInventoryItemModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        userId={user.id}
        projects={projects}
        onCreated={refresh}
      />
      <RecordTransactionModal
        isOpen={isTxnModalOpen}
        onClose={() => setIsTxnModalOpen(false)}
        userId={user.id}
        items={items}
        onCreated={refresh}
      />
      <CreateEquipmentModal
        isOpen={isEquipModalOpen}
        onClose={() => setIsEquipModalOpen(false)}
        userId={user.id}
        projects={projects}
        onCreated={refresh}
      />
    </div>
  );
}
