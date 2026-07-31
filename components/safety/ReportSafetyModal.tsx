"use client";

import { useState } from "react";
import { ShieldAlert, Loader2, X, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { reportSafetyIncident, type SafetyIncidentItem } from "@/lib/queries/safety";
import type { IncidentType, IncidentSeverity } from "@/types/database";

interface ReportSafetyModalProps {
  isOpen: boolean;
  userId: string;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSuccess: (newIncident: SafetyIncidentItem) => void;
}

const TYPE_OPTIONS: { value: IncidentType; label: string; description: string }[] = [
  { value: "near_miss", label: "Near-Miss (No Injury / Damage)", description: "Hazard observed, no one was hurt." },
  { value: "incident",  label: "Safety Incident (Injury or Property Damage)", description: "Actual injury, shock or structural damage occurred." },
];

const SEVERITY_OPTIONS: { value: IncidentSeverity; label: string }[] = [
  { value: "low",      label: "Low (Minor Hazard)" },
  { value: "medium",   label: "Medium (Moderate Risk)" },
  { value: "high",     label: "High (Serious Hazard)" },
  { value: "critical", label: "Critical (Life Threatening / Immediate Stop-Work)" },
];

export function ReportSafetyModal({
  isOpen,
  userId,
  projects,
  onClose,
  onSuccess,
}: ReportSafetyModalProps) {
  const supabase = createClient();

  const [incidentType, setIncidentType] = useState<IncidentType>("near_miss");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [projectId, setProjectId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !locationDetail.trim() || !description.trim()) {
      setErrorMsg("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await reportSafetyIncident(supabase, {
      reported_by: userId,
      project_id: projectId || null,
      incident_type: incidentType,
      severity,
      title: title.trim(),
      location_detail: locationDetail.trim(),
      description: description.trim(),
    });

    setIsSubmitting(false);

    if (!res.success || !res.incident) {
      setErrorMsg(res.error || "Failed to submit safety report.");
    } else {
      onSuccess(res.incident);
      resetForm();
    }
  };

  const resetForm = () => {
    setIncidentType("near_miss");
    setSeverity("medium");
    setProjectId("");
    setTitle("");
    setLocationDetail("");
    setDescription("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && resetForm()}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-rose-500" />
            Report Safety Incident / Near-Miss
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Report Category</label>
              <select
                value={incidentType}
                onChange={(e) => setIncidentType(e.target.value as IncidentType)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">Severity Rating</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as IncidentSeverity)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Related Project (Optional)</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">General Site / General Company Area</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Incident Summary / Title</label>
            <input
              type="text"
              required
              placeholder="e.g. Scaffolding plank slipped during formwork stripping"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Exact Location Detail</label>
            <input
              type="text"
              required
              placeholder="e.g. Tower A Level 4 East Edge Deck"
              value={locationDetail}
              onChange={(e) => setLocationDetail(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Detailed Description & Conditions</label>
            <textarea
              rows={3}
              required
              placeholder="Explain sequence of events, personnel involved, immediate hazard, or equipment status…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
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
              Submit Safety Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
