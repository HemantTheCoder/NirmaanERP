"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createChangeOrder } from "@/lib/queries/rfis";

interface CreateChangeOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  projects: { id: string; name: string }[];
  onCreated: () => void;
}

export function CreateChangeOrderModal({ isOpen, onClose, userId, projects, onCreated }: CreateChangeOrderModalProps) {
  const supabase = createClient();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reason, setReason] = useState("");
  const [costImpact, setCostImpact] = useState("0");
  const [scheduleImpactDays, setScheduleImpactDays] = useState("0");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function resetAndClose() {
    setProjectId("");
    setTitle("");
    setDescription("");
    setReason("");
    setCostImpact("0");
    setScheduleImpactDays("0");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const { error: createError } = await createChangeOrder(supabase, {
      project_id: projectId,
      title,
      description,
      reason: reason || undefined,
      cost_impact: Number(costImpact) || 0,
      schedule_impact_days: Number(scheduleImpactDays) || 0,
      requested_by: userId,
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
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">New Change Order</h2>
          <button onClick={resetAndClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto">
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
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Additional waterproofing at basement level"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <textarea
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why is this change necessary?"
              className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Cost impact (₹)</label>
              <input
                type="number"
                step="any"
                value={costImpact}
                onChange={(e) => setCostImpact(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">Negative = cost saving</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Schedule impact (days)</label>
              <input
                type="number"
                step="1"
                value={scheduleImpactDays}
                onChange={(e) => setScheduleImpactDays(e.target.value)}
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
              Create Change Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
