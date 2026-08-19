"use client";

import { useState } from "react";
import {
  FileCheck2,
  Sun,
  CloudRain,
  Cloud,
  Flame,
  Wind,
  Users,
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Edit3,
  Loader2,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  Plus,
  Trash2,
  Target,
  ListChecks,
  Link2,
  CheckSquare,
  Sparkles,
} from "lucide-react";
import {
  submitDpr,
  saveDprChecklist,
  calculatePpc,
  PPC_TARGET_PERCENT,
  type DailyProgressReport,
  type DprChecklistItem,
  type WeatherCondition,
} from "@/lib/queries/dpr";
import { updateTaskStatus } from "@/lib/queries/tasks";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface DailyProgressReportViewProps {
  projectId: string;
  initialHistory: DailyProgressReport[];
  initialTodayReport: DailyProgressReport | null;
  user: {
    id: string;
    role: UserRole;
  };
}

const WEATHER_CONFIG: Record<
  WeatherCondition,
  { label: string; icon: any; color: string; bg: string }
> = {
  clear: { label: "Clear & Sunny", icon: Sun, color: "text-amber-500", bg: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300" },
  rain: { label: "Rain / Monsoon", icon: CloudRain, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300" },
  overcast: { label: "Overcast / Cloudy", icon: Cloud, color: "text-slate-500", bg: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300" },
  extreme_heat: { label: "Extreme Heat", icon: Flame, color: "text-rose-500", bg: "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300" },
  other: { label: "High Wind / Dust", icon: Wind, color: "text-indigo-500", bg: "bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300" },
};

interface ChecklistDraft {
  description: string;
  is_completed: boolean;
  task_id: string | null;
}

/** Small tag marking an item as auto-fetched from a task, vs. typed by hand. */
function FromTaskTag() {
  return (
    <span
      title="Auto-fetched from a task assigned to this project"
      className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 shrink-0"
    >
      <Link2 className="w-3 h-3" />
      from task
    </span>
  );
}

/** Colour a PPC value against the alert target. */
function ppcBadgeClasses(ppc: number): string {
  if (ppc >= PPC_TARGET_PERCENT) {
    return "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300";
  }
  if (ppc >= PPC_TARGET_PERCENT - 20) {
    return "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300";
  }
  return "bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300";
}

function PpcBadge({ ppc }: { ppc: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold",
        ppcBadgeClasses(ppc)
      )}
    >
      <Target className="w-3.5 h-3.5" />
      PPC {ppc}%
      {ppc < PPC_TARGET_PERCENT && ` (below ${PPC_TARGET_PERCENT}% target)`}
    </span>
  );
}

/** Read-only checklist rendering, used in the submitted card and history log. */
function ChecklistSummary({
  items,
  markedDoneTaskIds,
  markingTaskId,
  onMarkTaskDone,
}: {
  items: DprChecklistItem[];
  markedDoneTaskIds?: Set<string>;
  markingTaskId?: string | null;
  onMarkTaskDone?: (taskId: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
        Planned Work Checklist ({items.filter((i) => i.is_completed).length} of {items.length} completed)
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const alreadyMarked = !!item.task_id && markedDoneTaskIds?.has(item.task_id);
          const isMarking = !!item.task_id && markingTaskId === item.task_id;

          return (
            <li key={item.id} className="flex items-start gap-2 text-xs">
              {item.is_completed ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              ) : (
                <X className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
              )}
              <span
                className={cn(
                  "flex-1",
                  item.is_completed
                    ? "text-muted-foreground line-through"
                    : "text-foreground font-medium"
                )}
              >
                {item.description}
              </span>
              {item.task_id && <FromTaskTag />}
              {item.is_completed && item.task_id && onMarkTaskDone && (
                alreadyMarked ? (
                  <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                    Task marked Done
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onMarkTaskDone(item.task_id as string)}
                    disabled={isMarking}
                    title="This only affects the task's own status — it does not change any other day's checklist."
                    className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 disabled:opacity-50 shrink-0"
                  >
                    <CheckSquare className="w-3 h-3" />
                    {isMarking ? "Marking…" : "Also mark task as Done"}
                  </button>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DailyProgressReportView({
  projectId,
  initialHistory,
  initialTodayReport,
  user,
}: DailyProgressReportViewProps) {
  const supabase = createClient();
  const [history, setHistory] = useState<DailyProgressReport[]>(initialHistory);
  const [todayReport, setTodayReport] = useState<DailyProgressReport | null>(initialTodayReport);

  const [isEditingForm, setIsEditingForm] = useState(initialTodayReport === null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);

  // Form states
  const [weather, setWeather] = useState<WeatherCondition>(initialTodayReport?.weather || "clear");
  const [manpowerCount, setManpowerCount] = useState<string>(initialTodayReport ? String(initialTodayReport.manpower_count) : "24");
  const [equipmentUsed, setEquipmentUsed] = useState<string>(initialTodayReport?.equipment_used || "Tower Crane, Concrete Boom Pump, 2x Scissor Lifts");
  const [workCompleted, setWorkCompleted] = useState<string>(initialTodayReport?.work_completed || "");
  const [delaysEncountered, setDelaysEncountered] = useState<string>(initialTodayReport?.delays_encountered || "");
  const [photosCount, setPhotosCount] = useState<string>(initialTodayReport ? String(initialTodayReport.photos_count) : "4");
  const [aiDrafting, setAiDrafting] = useState(false);
  const [aiDraftError, setAiDraftError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<ChecklistDraft[]>(
    (initialTodayReport?.checklist_items || []).map((i) => ({
      description: i.description,
      is_completed: i.is_completed,
      task_id: i.task_id,
    }))
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Opt-in "also mark task as Done" — deliberately not automatic. Tracked
  // client-side per session so the button can show confirmation without a
  // full task refetch; doesn't need to survive a reload.
  const [markedDoneTaskIds, setMarkedDoneTaskIds] = useState<Set<string>>(new Set());
  const [markingTaskId, setMarkingTaskId] = useState<string | null>(null);

  const handleMarkTaskDone = async (taskId: string) => {
    setMarkingTaskId(taskId);
    const { error } = await updateTaskStatus(supabase, taskId, "done");
    setMarkingTaskId(null);
    if (!error) {
      setMarkedDoneTaskIds((prev) => new Set(prev).add(taskId));
    } else {
      setErrorMsg(`Could not update the task's status: ${error.message}`);
    }
  };

  const todayDateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Live PPC as the user ticks items, ignoring blank rows they haven't filled in yet
  const draftItems = checklist.filter((i) => i.description.trim());
  const livePpc = calculatePpc(
    draftItems.map((i, idx) => ({
      id: String(idx),
      dpr_id: "",
      description: i.description,
      is_completed: i.is_completed,
      sequence: idx,
      task_id: i.task_id,
      created_at: "",
    }))
  );

  const addChecklistItem = () =>
    setChecklist((prev) => [...prev, { description: "", is_completed: false, task_id: null }]);

  const removeChecklistItem = (index: number) =>
    setChecklist((prev) => prev.filter((_, i) => i !== index));

  const updateChecklistItem = (index: number, patch: Partial<ChecklistDraft>) =>
    setChecklist((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

  const handleAiDraft = async () => {
    setAiDrafting(true);
    setAiDraftError(null);

    try {
      const res = await fetch("/api/ai/draft-dpr-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          weather,
          manpowerCount,
          equipmentUsed,
          delaysEncountered,
          checklist: checklist
            .filter((i) => i.description.trim())
            .map((i) => ({ description: i.description, is_completed: i.is_completed })),
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        setAiDraftError(result.error || "Failed to generate a draft.");
        return;
      }

      // Drafts, never auto-saves — the author still reviews/edits before
      // Save Report actually persists anything.
      setWorkCompleted(result.summary);
    } catch {
      setAiDraftError("Failed to reach the AI drafting service.");
    } finally {
      setAiDrafting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numManpower = Number(manpowerCount);
    if (isNaN(numManpower) || numManpower < 0) {
      setErrorMsg("Please enter a valid manpower count.");
      return;
    }
    if (!workCompleted.trim()) {
      setErrorMsg("Work completed description is required.");
      return;
    }
    if (!equipmentUsed.trim()) {
      setErrorMsg("Equipment used is required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await submitDpr(
      supabase,
      {
        project_id: projectId,
        weather,
        manpower_count: numManpower,
        equipment_used: equipmentUsed.trim(),
        work_completed: workCompleted.trim(),
        delays_encountered: delaysEncountered.trim() || null,
        photos_count: Number(photosCount) || 0,
        existingId: todayReport?.id,
      },
      user.id
    );

    if (!res.success || !res.data) {
      setIsSubmitting(false);
      setErrorMsg(res.error || "Failed to submit Daily Progress Report.");
      return;
    }

    const checklistRes = await saveDprChecklist(supabase, res.data.id, draftItems);

    setIsSubmitting(false);

    if (!checklistRes.success) {
      // The report itself saved — only the checklist failed, so say so precisely
      // rather than implying the whole submission was lost.
      setErrorMsg(
        `Report saved, but the planned work checklist could not be saved: ${checklistRes.error}`
      );
      return;
    }

    const savedItems: DprChecklistItem[] = draftItems.map((i, idx) => ({
      id: `${res.data!.id}-${idx}`,
      dpr_id: res.data!.id,
      description: i.description.trim(),
      is_completed: i.is_completed,
      sequence: idx,
      task_id: i.task_id,
      created_at: new Date().toISOString(),
    }));

    const saved: DailyProgressReport = {
      ...res.data,
      checklist_items: savedItems,
      ppc_percentage: calculatePpc(savedItems),
    };

    setSuccessMsg(todayReport ? "Today's Daily Progress Report updated!" : "Today's Daily Progress Report submitted!");
    setTodayReport(saved);
    setIsEditingForm(false);

    // Update history list
    setHistory((prev) => {
      const filtered = prev.filter((r) => r.report_date !== saved.report_date);
      return [saved, ...filtered];
    });
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Daily Progress Reports (DPR)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Site-level once-per-day structured record for weather, manpower, equipment, progress, and delays.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-secondary border border-border text-foreground flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-primary" /> {todayDateStr}
          </span>
        </div>
      </div>

      {/* ── Today's Submission Card / Form Section ───────────────────────────── */}
      {!isEditingForm && todayReport ? (
        <div className="bg-card border border-emerald-200 dark:border-emerald-900 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <h3 className="font-bold text-foreground text-sm">Today&apos;s DPR Submitted</h3>
              <span className="text-xs text-muted-foreground font-normal">
                (By {todayReport.submitter?.full_name || todayReport.submitter?.email || "Site Staff"})
              </span>
              {todayReport.ppc_percentage !== null && todayReport.ppc_percentage !== undefined && (
                <PpcBadge ppc={todayReport.ppc_percentage} />
              )}
            </div>

            <button
              onClick={() => setIsEditingForm(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-secondary hover:bg-muted text-foreground text-xs font-semibold rounded-xl border border-border transition-all"
            >
              <Edit3 className="w-3.5 h-3.5 text-indigo-500" /> Edit Today&apos;s Report
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Weather */}
            <div className="bg-secondary/40 p-3.5 rounded-xl border border-border flex items-center gap-3">
              {(() => {
                const WIcon = WEATHER_CONFIG[todayReport.weather].icon;
                return <WIcon className={cn("w-6 h-6 shrink-0", WEATHER_CONFIG[todayReport.weather].color)} />;
              })()}
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Weather Condition</p>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {WEATHER_CONFIG[todayReport.weather].label}
                </p>
              </div>
            </div>

            {/* Manpower */}
            <div className="bg-secondary/40 p-3.5 rounded-xl border border-border flex items-center gap-3">
              <Users className="w-6 h-6 text-indigo-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Site Manpower On-Duty</p>
                <p className="text-xs font-bold text-foreground mt-0.5">
                  {todayReport.manpower_count} Workers / Technicians
                </p>
              </div>
            </div>

            {/* Equipment */}
            <div className="bg-secondary/40 p-3.5 rounded-xl border border-border flex items-center gap-3">
              <Wrench className="w-6 h-6 text-amber-500 shrink-0" />
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">Equipment Active</p>
                <p className="text-xs font-bold text-foreground mt-0.5 line-clamp-1">
                  {todayReport.equipment_used}
                </p>
              </div>
            </div>
          </div>

          {/* Work Completed */}
          <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-1">
            <p className="text-xs font-semibold text-foreground">Work Completed Today:</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {todayReport.work_completed}
            </p>
          </div>

          <ChecklistSummary
            items={todayReport.checklist_items || []}
            markedDoneTaskIds={markedDoneTaskIds}
            markingTaskId={markingTaskId}
            onMarkTaskDone={handleMarkTaskDone}
          />

          {/* Delays */}
          {todayReport.delays_encountered && (
            <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 space-y-1">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Delays / Bottlenecks Encountered:
              </p>
              <p className="text-xs text-rose-800 dark:text-rose-300/90 leading-relaxed whitespace-pre-wrap">
                {todayReport.delays_encountered}
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Submission / Edit Form */
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              {todayReport ? "Edit Today's Daily Progress Report" : "Submit Today's Daily Progress Report"}
            </h3>
            {todayReport && (
              <button onClick={() => setIsEditingForm(false)} className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Site Weather Condition <span className="text-rose-500">*</span>
                </label>
                <select
                  value={weather}
                  onChange={(e) => setWeather(e.target.value as WeatherCondition)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {Object.entries(WEATHER_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Total Manpower On-Duty <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={manpowerCount}
                  onChange={(e) => setManpowerCount(e.target.value)}
                  placeholder="e.g. 28"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Site Photos Captured Count
                </label>
                <input
                  type="number"
                  min={0}
                  value={photosCount}
                  onChange={(e) => setPhotosCount(e.target.value)}
                  placeholder="e.g. 6"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Equipment & Machinery Deployed <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={equipmentUsed}
                onChange={(e) => setEquipmentUsed(e.target.value)}
                placeholder="e.g. Tower Crane #1, Concrete Boom Pump, 25T Mobile Crane, Batching Plant"
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  Work Completed Today <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={handleAiDraft}
                  disabled={aiDrafting}
                  className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  title="Draft this from the checklist, manpower, and weather below — review before saving"
                >
                  {aiDrafting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {aiDrafting ? "Drafting…" : "AI Draft"}
                </button>
              </div>
              <textarea
                rows={3}
                required
                value={workCompleted}
                onChange={(e) => setWorkCompleted(e.target.value)}
                placeholder="Detailed breakdown of activities completed today (e.g. Completed slab casting for Level 4, started column rebar tying for Level 5...)"
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              {aiDraftError && (
                <p className="text-[11px] text-rose-500 mt-1">{aiDraftError}</p>
              )}
            </div>

            {/* Planned Work Checklist — drives PPC */}
            <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-indigo-500" />
                    Planned Work Checklist
                  </label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    List what was planned for today, then tick off what actually got done. This drives PPC.
                  </p>
                </div>

                {livePpc !== null && <PpcBadge ppc={livePpc} />}
              </div>

              <div className="space-y-2">
                {checklist.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic py-1">
                    No planned items yet — PPC will not be calculated for this report.
                  </p>
                )}

                {checklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      onChange={(e) => updateChecklistItem(index, { is_completed: e.target.checked })}
                      aria-label={`Mark planned item ${index + 1} complete`}
                      className="w-4 h-4 shrink-0 rounded border-border text-indigo-600 focus:ring-2 focus:ring-primary cursor-pointer accent-indigo-600"
                    />
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateChecklistItem(index, { description: e.target.value })}
                      placeholder="e.g. Complete column rebar tying, Level 5"
                      className={cn(
                        "flex-1 px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary",
                        item.is_completed && "line-through text-muted-foreground"
                      )}
                    />
                    {item.task_id && <FromTaskTag />}
                    <button
                      type="button"
                      onClick={() => removeChecklistItem(index)}
                      aria-label={`Remove planned item ${index + 1}`}
                      className="p-2 text-muted-foreground hover:text-rose-500 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addChecklistItem}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add planned item
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Delays / Bottlenecks Encountered (Optional)
              </label>
              <textarea
                rows={2}
                value={delaysEncountered}
                onChange={(e) => setDelaysEncountered(e.target.value)}
                placeholder="Specify any site delays, rain stoppages, material delivery wait time..."
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {todayReport ? "Save Changes to Today's DPR" : "Submit Today's DPR"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Chronological DPR History Log ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            Chronological Daily Progress Report History
            <span className="text-xs font-normal text-muted-foreground">
              ({history.length} reports logged)
            </span>
          </h3>
        </div>

        <div className="divide-y divide-border">
          {history.length === 0 ? (
            <div className="text-center py-10 text-xs text-muted-foreground">
              No historical Daily Progress Reports logged yet for this project.
            </div>
          ) : (
            history.map((report) => {
              const weatherCfg = WEATHER_CONFIG[report.weather];
              const WeatherIcon = weatherCfg.icon;
              const isExpanded = expandedReportId === report.id;

              return (
                <div key={report.id} className="py-3.5 space-y-2 hover:bg-muted/30 transition-colors px-2 rounded-xl">
                  {/* Header Row */}
                  <div
                    onClick={() => setExpandedReportId(isExpanded ? null : report.id)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      {/* Date Badge */}
                      <span className="px-3 py-1 rounded-lg bg-secondary border border-border text-xs font-bold text-foreground whitespace-nowrap">
                        {new Date(report.report_date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>

                      {/* Weather Icon Badge */}
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold", weatherCfg.bg)}>
                        <WeatherIcon className={cn("w-3.5 h-3.5", weatherCfg.color)} />
                        {weatherCfg.label}
                      </span>

                      {/* Manpower */}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        <strong className="text-foreground">{report.manpower_count}</strong> workers
                      </span>

                      {report.ppc_percentage !== null && report.ppc_percentage !== undefined && (
                        <PpcBadge ppc={report.ppc_percentage} />
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-[11px] text-muted-foreground">
                        Submitted by: {report.submitter?.full_name?.split(" ")[0] || "Staff"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Summary Snippet */}
                  <p className="text-xs text-foreground/90 font-medium line-clamp-1 pl-1">
                    {report.work_completed}
                  </p>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="mt-3 p-4 rounded-xl bg-secondary/40 border border-border space-y-3 animate-in fade-in zoom-in-95 duration-150">
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">Detailed Work Completed:</p>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                          {report.work_completed}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">Equipment & Machinery Used:</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {report.equipment_used}
                        </p>
                      </div>

                      <ChecklistSummary
                        items={report.checklist_items || []}
                        markedDoneTaskIds={markedDoneTaskIds}
                        markingTaskId={markingTaskId}
                        onMarkTaskDone={handleMarkTaskDone}
                      />

                      {report.delays_encountered && (
                        <div className="p-3 rounded-lg bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1">
                          <p className="text-xs font-semibold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Site Delays Encountered:
                          </p>
                          <p className="text-xs text-rose-800 dark:text-rose-300/90 whitespace-pre-wrap">
                            {report.delays_encountered}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
