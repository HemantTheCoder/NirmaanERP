"use client";

import { useState } from "react";
import { X, Loader2, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createPurchaseOrder } from "@/lib/queries/procurement";
import type { Vendor } from "@/lib/queries/procurement";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  projects: { id: string; name: string }[];
  vendors: Vendor[];
  onCreated: () => void;
}

interface LineItemDraft {
  item_name: string;
  quantity: string;
  unit: string;
  unit_price: string;
}

const EMPTY_ITEM: LineItemDraft = { item_name: "", quantity: "1", unit: "unit", unit_price: "0" };

export function CreatePOModal({ isOpen, onClose, userId, projects, vendors, onCreated }: CreatePOModalProps) {
  const supabase = createClient();
  const [projectId, setProjectId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setProjectId("");
    setVendorId("");
    setExpectedDeliveryDate("");
    setNotes("");
    setItems([{ ...EMPTY_ITEM }]);
    setError(null);
    onClose();
  }

  function updateItem(index: number, field: keyof LineItemDraft, value: string) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  const total = items.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0),
    0
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const validItems = items
      .filter((it) => it.item_name.trim())
      .map((it) => ({
        item_name: it.item_name.trim(),
        quantity: Number(it.quantity) || 0,
        unit: it.unit.trim() || "unit",
        unit_price: Number(it.unit_price) || 0,
      }));

    if (validItems.length === 0) {
      setError("Add at least one line item.");
      setIsSubmitting(false);
      return;
    }

    const { error: createError } = await createPurchaseOrder(supabase, {
      project_id: projectId,
      vendor_id: vendorId,
      expected_delivery_date: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      created_by: userId,
      items: validItems,
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
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">Create Purchase Order</h2>
          <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Project</label>
              <select
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Vendor</label>
              <select
                required
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select vendor</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Expected delivery date</label>
            <input
              type="date"
              value={expectedDeliveryDate}
              onChange={(e) => setExpectedDeliveryDate(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-muted-foreground">Line items</label>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500"
              >
                <Plus className="w-3.5 h-3.5" /> Add item
              </button>
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-[1fr_70px_70px_90px_28px] gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.item_name}
                    onChange={(e) => updateItem(index, "item_name", e.target.value)}
                    className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", e.target.value)}
                    className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={item.unit}
                    onChange={(e) => updateItem(index, "unit", e.target.value)}
                    className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="₹/unit"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                    className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                    className="text-muted-foreground hover:text-rose-500 disabled:opacity-30 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end mt-3 pt-2 border-t border-border text-sm">
              <span className="text-muted-foreground mr-2">Total:</span>
              <span className="font-bold text-foreground">₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
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
              Create Purchase Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
