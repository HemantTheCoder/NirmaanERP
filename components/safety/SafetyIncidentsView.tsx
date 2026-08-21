"use client";

import { useState } from "react";
import {
  ShieldAlert,
  Plus,
  Filter,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Users,
  MapPin,
  Building2,
  UserCheck,
  Zap,
  Sparkles,
  Loader2,
} from "lucide-react";
import { ReportSafetyModal } from "./ReportSafetyModal";
import { ResolveSafetyModal } from "./ResolveSafetyModal";
import type { SafetyIncidentItem } from "@/lib/queries/safety";
import type { IncidentType, IncidentSeverity, IncidentStatus, UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface SafetyIncidentsViewProps {
  initialIncidents: SafetyIncidentItem[];
  userId: string;
  userRole: UserRole;
  projects: { id: string; name: string }[];
  managers: { id: string; full_name: string | null; email: string }[];
}

interface SafetyPatternItem {
  theme: string;
  severity: "low" | "medium" | "high";
  evidenceCount: number;
  exampleIncidents: string[];
}

interface SafetyPatternsResult {
  narrative: string;
  patterns: SafetyPatternItem[];
}

const PATTERN_SEVERITY_CLASSNAME: Record<SafetyPatternItem["severity"], string> = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  high: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800",
};

const TYPE_CONFIG: Record<IncidentType, { label: string; bg: string; text: string }> = {
  near_miss: { label: "Near-Miss", bg: "bg-sky-100 dark:bg-sky-950/60", text: "text-sky-800 dark:text-sky-300" },
  incident:  { label: "Incident",  bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; className: string }> = {
  low:      { label: "Low Severity",      className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700" },
  medium:   { label: "Medium Risk",      className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800" },
  high:     { label: "High Hazard",      className: "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800" },
  critical: { label: "CRITICAL HAZARD", className: "bg-rose-600 text-white font-extrabold border-2 border-rose-400 shadow-md animate-pulse" },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; bg: string; text: string }> = {
  reported:     { label: "Reported",      bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  under_review: { label: "Under Review",  bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  action_taken: { label: "Action Taken",  bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  closed:       { label: "Closed",        bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-700 dark:text-slate-300" },
};

export function SafetyIncidentsView({
  initialIncidents,
  userId,
  userRole,
  projects,
  managers,
}: SafetyIncidentsViewProps) {
  const isManager = userRole === "admin" || userRole === "project_manager";

  const [incidents, setIncidents] = useState<SafetyIncidentItem[]>(initialIncidents);
  const [activeTab, setActiveTab] = useState<"all" | "my">(isManager ? "all" : "my");

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [showReportModal, setShowReportModal] = useState(false);
  const [incidentToResolve, setIncidentToResolve] = useState<SafetyIncidentItem | null>(null);

  const [patternProjectId, setPatternProjectId] = useState<string>("all");
  const [patternsLoading, setPatternsLoading] = useState(false);
  const [patternsError, setPatternsError] = useState<string | null>(null);
  const [patternsResult, setPatternsResult] = useState<SafetyPatternsResult | null>(null);

  const handleFindPatterns = async () => {
    setPatternsLoading(true);
    setPatternsError(null);

    try {
      const res = await fetch("/api/ai/safety-patterns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: patternProjectId === "all" ? null : patternProjectId }),
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setPatternsError(result.error || "Failed to analyze incident patterns.");
        return;
      }

      setPatternsResult(result);
    } catch {
      setPatternsError("Failed to reach the AI pattern detection service.");
    } finally {
      setPatternsLoading(false);
    }
  };

  // Filter logic
  const filteredIncidents = incidents.filter((item) => {
    const matchesTab = activeTab === "all" || item.reported_by === userId;
    const matchesType = typeFilter === "all" || item.incident_type === typeFilter;
    const matchesSeverity = severityFilter === "all" || item.severity === severityFilter;
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesTab && matchesType && matchesSeverity && matchesStatus;
  });

  const handleIncidentSubmitted = (newIncident: SafetyIncidentItem) => {
    setIncidents((prev) => [newIncident, ...prev]);
  };

  const handleIncidentResolved = (updated: SafetyIncidentItem) => {
    setIncidents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-border pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Safety Incident & Near-Miss Reporting
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Log structural site hazards, near-miss events, and emergency safety incidents across projects.
          </p>
        </div>

        <button
          onClick={() => setShowReportModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-sm shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Report Safety Issue
        </button>
      </div>

      {/* AI Safety Pattern Insights — manager only */}
      {isManager && (
        <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-indigo-500" />
                Safety Pattern Insights
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI review of recent incidents for recurring hazards — by location, day, or type.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={patternProjectId}
                onChange={(e) => setPatternProjectId(e.target.value)}
                disabled={patternsLoading}
                className="px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleFindPatterns}
                disabled={patternsLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-all"
              >
                {patternsLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                {patternsLoading ? "Analyzing…" : "Find Patterns"}
              </button>
            </div>
          </div>

          {patternsError && <p className="text-xs text-rose-500">{patternsError}</p>}

          {patternsResult && (
            <div className="pt-2 border-t border-indigo-200 dark:border-indigo-900 space-y-3">
              <p className="text-xs text-foreground/90 leading-relaxed">{patternsResult.narrative}</p>
              {patternsResult.patterns.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {patternsResult.patterns.map((p, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-card border border-border space-y-1.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">{p.theme}</p>
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0",
                            PATTERN_SEVERITY_CLASSNAME[p.severity]
                          )}
                        >
                          {p.severity}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {p.evidenceCount} related report{p.evidenceCount === 1 ? "" : "s"}
                      </p>
                      <ul className="text-[11px] text-muted-foreground list-disc list-inside space-y-0.5">
                        {p.exampleIncidents.slice(0, 3).map((ex, i) => (
                          <li key={i} className="truncate">{ex}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filter & Sub-Tab Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        {/* Manager Sub-tabs */}
        {isManager ? (
          <div className="flex bg-secondary/80 p-1 rounded-xl border border-border">
            <button
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              All Reports ({incidents.length})
            </button>

            <button
              onClick={() => setActiveTab("my")}
              className={cn(
                "flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-lg transition-all",
                activeTab === "my"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              My Submissions ({incidents.filter((i) => i.reported_by === userId).length})
            </button>
          </div>
        ) : (
          <div className="text-xs font-semibold text-muted-foreground">
            Showing safety reports submitted by you ({filteredIncidents.length})
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Types</option>
              <option value="near_miss">Near-Miss</option>
              <option value="incident">Incident</option>
            </select>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-semibold"
          >
            <option value="all">All Severities</option>
            <option value="low">Low Severity</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Hazard</option>
            <option value="critical">Critical Hazard</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="reported">Reported</option>
            <option value="under_review">Under Review</option>
            <option value="action_taken">Action Taken</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Safety Incidents Cards */}
      <div className="space-y-4">
        {filteredIncidents.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground shadow-sm">
            <ShieldAlert className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="font-semibold text-foreground">No safety incidents reported</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Click "Report Safety Issue" to log site hazards or near-miss events.
            </p>
          </div>
        ) : (
          filteredIncidents.map((item) => {
            const typeCfg = TYPE_CONFIG[item.incident_type] || TYPE_CONFIG.near_miss;
            const sevCfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.medium;
            const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.reported;

            return (
              <div
                key={item.id}
                className={cn(
                  "bg-card border rounded-2xl p-5 shadow-sm space-y-4 transition-colors",
                  item.severity === "critical"
                    ? "border-rose-500/80 bg-rose-500/5 dark:bg-rose-950/20"
                    : "border-border hover:border-border/80"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold",
                          typeCfg.bg,
                          typeCfg.text
                        )}
                      >
                        {typeCfg.label}
                      </span>

                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs",
                          sevCfg.className
                        )}
                      >
                        {item.severity === "critical" && <Zap className="w-3 h-3 text-white animate-bounce" />}
                        {sevCfg.label}
                      </span>

                      <span
                        className={cn(
                          "inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold",
                          statusCfg.bg,
                          statusCfg.text
                        )}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-foreground pt-1">{item.title}</h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                        <strong className="text-foreground">{item.location_detail}</strong>
                      </span>

                      {item.project_name && (
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>{item.project_name}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Manager Action Button */}
                  {isManager && (
                    <button
                      onClick={() => setIncidentToResolve(item)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/80 transition-all border border-indigo-200 dark:border-indigo-800 shrink-0 self-start"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                      Action / Resolve
                    </button>
                  )}
                </div>

                {/* Description Body */}
                <p className="text-xs text-foreground/90 whitespace-pre-line bg-secondary/30 p-3 rounded-xl border border-border/60">
                  {item.description}
                </p>

                {/* Corrective Action Display (if present) */}
                {item.corrective_action && (
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 space-y-1">
                    <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      Corrective Action Implemented:
                    </p>
                    <p className="text-xs text-emerald-900 dark:text-emerald-200">
                      {item.corrective_action}
                    </p>
                  </div>
                )}

                {/* Footer Metadata */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-border/60 pt-3">
                  <div className="flex items-center gap-4">
                    <span>
                      Reported by:{" "}
                      <strong className="text-foreground font-medium">
                        {item.reporter?.full_name || item.reporter?.email || "User"}
                      </strong>
                    </span>

                    <span>
                      Date:{" "}
                      {new Date(item.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <UserCheck className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>
                      Safety Manager:{" "}
                      <strong className="text-foreground font-medium">
                        {item.assignee?.full_name || item.assignee?.email || "Unassigned"}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Report Safety Modal */}
      <ReportSafetyModal
        isOpen={showReportModal}
        userId={userId}
        projects={projects}
        onClose={() => setShowReportModal(false)}
        onSuccess={handleIncidentSubmitted}
      />

      {/* Resolve Safety Modal (Admin/PM) */}
      <ResolveSafetyModal
        incident={incidentToResolve}
        isOpen={!!incidentToResolve}
        userId={userId}
        managers={managers}
        onClose={() => setIncidentToResolve(null)}
        onSuccess={handleIncidentResolved}
      />
    </div>
  );
}
