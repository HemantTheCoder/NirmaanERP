"use client";

import { useState } from "react";
import { PackagePlus, Loader2, X, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { requestResource, type ResourceAllocationItem } from "@/lib/queries/resources";
import type { ResourceType } from "@/types/database";

interface RequestResourceModalProps {
  isOpen: boolean;
  projectId: string;
  userId: string;
  onClose: () => void;
  onSuccess: (newResource: ResourceAllocationItem) => void;
}

const RESOURCE_TYPES: { value: ResourceType; label: string; placeholderUnit: string }[] = [
  { value: "material",  label: "Material",  placeholderUnit: "e.g. tons, bags, cu.m" },
  { value: "equipment", label: "Equipment", placeholderUnit: "e.g. units, hours, days" },
  { value: "labor",     label: "Labor",      placeholderUnit: "e.g. person-days, workers" },
];

export function RequestResourceModal({
  isOpen,
  projectId,
  userId,
  onClose,
  onSuccess,
}: RequestResourceModalProps) {
  const supabase = createClient();

  const [resourceType, setResourceType] = useState<ResourceType>("material");
  const [resourceName, setResourceName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentTypeCfg = RESOURCE_TYPES.find((t) => t.value === resourceType) ?? RESOURCE_TYPES[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedQty = parseFloat(quantity);

    if (!resourceName.trim() || !unit.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMsg("Quantity must be a positive number greater than 0.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await requestResource(supabase, {
      project_id: projectId,
      resource_type: resourceType,
      resource_name: resourceName.trim(),
      quantity: parsedQty,
      unit: unit.trim(),
      requested_by: userId,
      notes: notes.trim() || undefined,
    });

    setIsSubmitting(false);

    if (!res.success || !res.resource) {
      setErrorMsg(res.error || "Failed to submit resource request.");
    } else {
      onSuccess(res.resource);
      resetForm();
    }
  };

  const resetForm = () => {
    setResourceType("material");
    setResourceName("");
    setQuantity("1");
    setUnit("");
    setNotes("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && resetForm()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <PackagePlus className="w-4.5 h-4.5 text-primary" />
            Request Project Resource
          </h3>
          <button onClick={resetForm} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Resource Category</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value as ResourceType)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Resource Name</label>
            <input
              type="text"
              required
              placeholder="e.g. TMT Steel 16mm / Tower Crane 50m / Mason Crew"
              value={resourceName}
              onChange={(e) => setResourceName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Quantity</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                placeholder="100"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Unit of Measure</label>
              <input
                type="text"
                required
                placeholder={currentTypeCfg.placeholderUnit}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Notes / Justification</label>
            <textarea
              rows={3}
              placeholder="Explain site requirements, allocation timeframe, or delivery specs…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
