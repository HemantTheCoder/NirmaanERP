"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createInventoryItem, type InventoryCategory } from "@/lib/queries/inventory";

interface CreateInventoryItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

export function CreateInventoryItemModal({ isOpen, onClose, userId, projects, onCreated }: CreateInventoryItemModalProps) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("material");
  const [unit, setUnit] = useState("");
  const [projectId, setProjectId] = useState("");
  const [quantityOnHand, setQuantityOnHand] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("0");
  const [unitCost, setUnitCost] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setName("");
    setCategory("material");
    setUnit("");
    setProjectId("");
    setQuantityOnHand("0");
    setReorderLevel("0");
    setUnitCost("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: createError } = await createInventoryItem(supabase, {
      name,
      category,
      unit,
      project_id: projectId || undefined,
      quantity_on_hand: Number(quantityOnHand) || 0,
      reorder_level: Number(reorderLevel) || 0,
      unit_cost: unitCost ? Number(unitCost) : undefined,
      created_by: userId,
    });

    if (createError) {
      setError(createError.message);
      setIsSubmitting(false);
      return;
    }

    setIsSubmitting(false);
    onCreated();
    resetAndClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Add Inventory Item</h2>
          <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Item name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. OPC 53 Cement"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InventoryCategory)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="material">Material</option>
                <option value="consumable">Consumable</option>
                <option value="tool">Tool</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unit</label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="bag, kg, piece..."
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Project (optional — leave blank for central warehouse)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Central warehouse</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Opening stock</label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantityOnHand}
                onChange={(e) => setQuantityOnHand(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reorder level</label>
              <input
                type="number"
                min="0"
                step="any"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Unit cost (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={resetAndClose}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-muted/40 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-colors"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
