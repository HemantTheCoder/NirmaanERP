"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, Loader2, X, AlertTriangle, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateSafetyIncidentStatus, type SafetyIncidentItem } from "@/lib/queries/safety";
import type { IncidentStatus } from "@/types/database";

interface ResolveSafetyModalProps {
  incident: SafetyIncidentItem | null;
  isOpen: boolean;
  userId: string;
  managers: { id: string; full_name: string | null; email: string }[];
  onClose: () => void;
  onSuccess: (updatedIncident: SafetyIncidentItem) => void;
}

export function ResolveSafetyModal({
  incident,
  isOpen,
  userId,
  managers,
  onClose,
  onSuccess,
}: ResolveSafetyModalProps) {
  const supabase = createClient();

  const [status, setStatus] = useState<IncidentStatus>("reported");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [correctiveAction, setCorrectiveAction] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (incident) {
      setStatus(incident.status);
      setAssignedTo(incident.assigned_to || userId);
      setCorrectiveAction(incident.corrective_action || "");
      setErrorMsg(null);
    }
  }, [incident, userId]);

  if (!isOpen || !incident) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if ((status === "action_taken" || status === "closed") && !correctiveAction.trim()) {
      setErrorMsg("Corrective action details are required before marking status as Action Taken or Closed.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await updateSafetyIncidentStatus(supabase, {
      incidentId: incident.id,
      status,
      assignedTo: assignedTo || null,
      correctiveAction: correctiveAction.trim() || undefined,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update safety report.");
    } else {
      const assignedManager = managers.find((m) => m.id === assignedTo);
      onSuccess({
        ...incident,
        status,
        assigned_to: assignedTo || null,
        corrective_action: correctiveAction.trim() || null,
        closed_at: status === "closed" ? new Date().toISOString() : incident.closed_at,
        assignee: assignedManager
          ? { full_name: assignedManager.full_name, email: assignedManager.email }
          : undefined,
      });
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4.5 h-4.5 text-primary" />
            Action / Resolve Safety Report
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
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

          <div className="p-3 bg-secondary/50 rounded-xl border border-border space-y-1">
            <p className="text-xs font-bold text-foreground">{incident.title}</p>
            <p className="text-[11px] text-muted-foreground">Location: {incident.location_detail}</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-foreground">Safety Manager / Reviewer</label>
              <button
                type="button"
                onClick={() => setAssignedTo(userId)}
                className="text-[11px] text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <UserCheck className="w-3 h-3" />
                Assign to Me
              </button>
            </div>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Unassigned</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Safety Status Progression</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
            >
              <option value="reported">Reported (Logged)</option>
              <option value="under_review">Under Review (Inspecting Site)</option>
              <option value="action_taken">Action Taken (Corrective Barrier Implemented)</option>
              <option value="closed">Closed (Hazard Resolved & Verified)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Corrective Action Taken {(status === "action_taken" || status === "closed") && <span className="text-rose-500">*</span>}
            </label>
            <textarea
              rows={3}
              placeholder="Detail safety barriers installed, equipment tagged out, PPE re-issued, or site retraining completed…"
              value={correctiveAction}
              onChange={(e) => setCorrectiveAction(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
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
              Save Safety Update
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
