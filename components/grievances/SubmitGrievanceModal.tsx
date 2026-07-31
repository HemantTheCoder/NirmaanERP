"use client";

import { useState } from "react";
import { AlertCircle, Loader2, X, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitGrievance, type GrievanceItem } from "@/lib/queries/grievances";
import type { GrievanceCategory } from "@/types/database";

interface SubmitGrievanceModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onSuccess: (newGrievance: GrievanceItem) => void;
}

const CATEGORY_OPTIONS: { value: GrievanceCategory; label: string }[] = [
  { value: "safety",    label: "Site Safety Violation / Hazard" },
  { value: "equipment", label: "Equipment Failure / Maintenance Issue" },
  { value: "hr",        label: "HR, Payroll or Working Conditions" },
  { value: "other",     label: "Other Issue / General Grievance" },
];

export function SubmitGrievanceModal({
  isOpen,
  userId,
  onClose,
  onSuccess,
}: SubmitGrievanceModalProps) {
  const supabase = createClient();

  const [category, setCategory] = useState<GrievanceCategory>("safety");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setErrorMsg("Please fill in both the title and detailed description.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await submitGrievance(supabase, {
      submitted_by: userId,
      category,
      title: title.trim(),
      description: description.trim(),
    });

    setIsSubmitting(false);

    if (!res.success || !res.grievance) {
      setErrorMsg(res.error || "Failed to submit issue report.");
    } else {
      onSuccess(res.grievance);
      resetForm();
    }
  };

  const resetForm = () => {
    setCategory("safety");
    setTitle("");
    setDescription("");
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
            <AlertCircle className="w-4.5 h-4.5 text-rose-500" />
            Report an Issue / Grievance
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
            <label className="block text-xs font-semibold text-foreground mb-1">Issue Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as GrievanceCategory)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Subject / Summary</label>
            <input
              type="text"
              required
              placeholder="e.g. Scaffolding railing loose at Tower A 6th level"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Detailed Description</label>
            <textarea
              rows={4}
              required
              placeholder="Provide exact site location, observed risks, or personnel involved…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all shadow-sm"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Submit Issue Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
