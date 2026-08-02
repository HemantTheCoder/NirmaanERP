"use client";

import { useState } from "react";
import {
  AlertOctagon,
  Plus,
  Filter,
  CheckCircle2,
  Clock,
  MapPin,
  UserCheck,
  AlertTriangle,
  Loader2,
  X,
  FileImage,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import {
  createPunchItem,
  updatePunchItemStatus,
  type PunchItem,
  type PunchItemSeverity,
  type PunchItemStatus,
  type AnnotationShape,
} from "@/lib/queries/punch_list";
import { PunchItemAnnotator } from "@/components/projects/PunchItemAnnotator";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface PunchListViewProps {
  projectId: string;
  initialItems: PunchItem[];
  user: {
    id: string;
    role: UserRole;
  };
  teamMembers?: { id: string; full_name: string | null; email: string }[];
}

const SEVERITY_BADGES: Record<PunchItemSeverity, { label: string; bg: string; text: string }> = {
  minor: { label: "Minor", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  moderate: { label: "Moderate", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  major: { label: "Major", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

const STATUS_BADGES: Record<PunchItemStatus, { label: string; bg: string; text: string }> = {
  open: { label: "Open", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
  in_progress: { label: "In Progress", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  resolved: { label: "Resolved", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  verified: { label: "Verified QA", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
};

// Default high-res construction defect sample image if user doesn't upload custom file
const SAMPLE_DEFECT_PHOTOS = [
  "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
];

export function PunchListView({
  projectId,
  initialItems,
  user,
  teamMembers = [],
}: PunchListViewProps) {
  const supabase = createClient();
  const [items, setItems] = useState<PunchItem[]>(initialItems);

  // Filters
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PunchItem | null>(null);

  // Add Item Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [severity, setSeverity] = useState<PunchItemSeverity>("moderate");
  const [assignedTo, setAssignedTo] = useState("");
  const [photoUrl, setPhotoUrl] = useState(SAMPLE_DEFECT_PHOTOS[0]);
  const [annotationData, setAnnotationData] = useState<AnnotationShape[]>([
    { type: "circle", x: 0.45, y: 0.4, radius: 0.12 },
    { type: "arrow", x: 0.2, y: 0.25, endX: 0.42, endY: 0.38 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Compute metrics
  const totalCount = items.length;
  const openCount = items.filter((i) => i.status === "open").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const resolvedCount = items.filter((i) => i.status === "resolved" || i.status === "verified").length;
  const majorCount = items.filter((i) => i.severity === "major").length;

  // Filter items
  const filteredItems = items.filter((item) => {
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (
      searchQuery.trim() &&
      !item.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.location_detail.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !item.description.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !locationDetail.trim() || !description.trim()) {
      setErrorMsg("Title, Location Detail, and Description are required.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const res = await createPunchItem(
      supabase,
      {
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        location_detail: locationDetail.trim(),
        severity,
        photo_path: photoUrl,
        annotation_data: annotationData.length > 0 ? annotationData : null,
        assigned_to: assignedTo || null,
      },
      user.id
    );

    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.error || "Failed to create punch item.");
    } else {
      setSuccessMsg("Punch list item logged successfully!");
      setItems([res.data, ...items]);
      setIsAddModalOpen(false);

      // Reset form
      setTitle("");
      setDescription("");
      setLocationDetail("");
      setSeverity("moderate");
      setAssignedTo("");
    }
  };

  const handleStatusChange = async (item: PunchItem, newStatus: PunchItemStatus) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await updatePunchItemStatus(supabase, item.id, newStatus);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update status.");
    } else {
      const updated = {
        ...item,
        status: newStatus,
        resolved_at: newStatus === "resolved" || newStatus === "verified" ? new Date().toISOString() : null,
      };

      setItems((prev) => prev.map((i) => (i.id === item.id ? updated : i)));
      setSelectedItem(updated);
      setSuccessMsg(`Punch item status updated to ${STATUS_BADGES[newStatus].label}!`);
    }
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

      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-rose-500" /> Quality Control & Punch List Register
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defect snagging, visual photo markup annotations, and QA resolution tracking per grid location.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-rose-500/20 transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Log Punch Item
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Total Defects Logged</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Project QA Register</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Open Snags</p>
          <p className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{openCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Awaiting Site Action</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">In Progress & Resolved</p>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{inProgressCount + resolvedCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Under QA Remediation</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Major Defects</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{majorCount}</p>
          <p className="text-[11px] text-muted-foreground mt-1">Critical Priority</p>
        </div>
      </div>

      {/* Filter Bar Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, location..."
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 w-full sm:w-56"
          />

          {/* Severity Filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Severities</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major">Major</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="verified">Verified</option>
          </select>
        </div>

        <span className="text-xs text-muted-foreground">
          Showing {filteredItems.length} of {totalCount} punch items
        </span>
      </div>

      {/* Punch Items Grid */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-2xl p-6">
          <AlertOctagon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">No punch list items found.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Log quality snags or defect items with photo markup annotations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const sevCfg = SEVERITY_BADGES[item.severity];
            const statCfg = STATUS_BADGES[item.status];

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs hover:shadow-md hover:border-rose-400 dark:hover:border-rose-800 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  {/* Photo Canvas Preview Header */}
                  <div className="relative h-48 bg-black/10 overflow-hidden border-b border-border">
                    {item.photo_path ? (
                      <PunchItemAnnotator
                        photoUrl={item.photo_path}
                        initialShapes={item.annotation_data || []}
                        readOnly={true}
                        className="w-full h-full pointer-events-none"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/40 p-4">
                        <FileImage className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-xs font-medium">No Photo Markup Attached</span>
                      </div>
                    )}

                    {/* Status badge top-left overlay */}
                    <div className="absolute top-3 left-3 z-10 flex gap-2">
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs", statCfg.bg, statCfg.text)}>
                        {statCfg.label}
                      </span>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs", sevCfg.bg, sevCfg.text)}>
                        {sevCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="p-4 space-y-2">
                    <h3 className="font-bold text-foreground text-sm group-hover:text-rose-600 transition-colors line-clamp-1">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span className="truncate">{item.location_detail}</span>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="p-4 pt-0 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground mt-3">
                  <span>Logged: {new Date(item.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                  <span className="flex items-center gap-1 text-rose-600 font-semibold group-hover:translate-x-0.5 transition-transform">
                    Inspect Defect <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Punch Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <AlertOctagon className="w-4 h-4 text-rose-500" /> Log Quality Punch Item & Canvas Markup
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Photo Upload & Live Canvas Annotator */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Defect Site Photo & Canvas Markup <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">Sample Defect Photos:</span>
                  {SAMPLE_DEFECT_PHOTOS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPhotoUrl(url)}
                      className={cn(
                        "px-2 py-0.5 text-[11px] rounded font-semibold border transition-all",
                        photoUrl === url ? "bg-rose-500 text-white border-rose-500" : "bg-muted text-muted-foreground border-border"
                      )}
                    >
                      Sample #{idx + 1}
                    </button>
                  ))}
                </div>

                <PunchItemAnnotator
                  photoUrl={photoUrl}
                  initialShapes={annotationData}
                  onChange={(shapes) => setAnnotationData(shapes)}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Use Circle, Arrow, or Pin tools above to mark exact snag location directly on the photo canvas.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Punch Item Title <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Paint Mismatch on North Wall"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Grid Location Detail <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={locationDetail}
                    onChange={(e) => setLocationDetail(e.target.value)}
                    placeholder="e.g. Level 3, Apartment 302 Living Room"
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Defect Severity <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value as PunchItemSeverity)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="minor">Minor (Cosmetic touch-up)</option>
                    <option value="moderate">Moderate (Rework required)</option>
                    <option value="major">Major (Critical structural/QA defect)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Assignee (Optional)
                  </label>
                  <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name || m.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Detailed Description & Remediation Instructions <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe defect, root cause, and necessary corrective action..."
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Log Punch Defect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Detail & Status Change Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", STATUS_BADGES[selectedItem.status].bg, STATUS_BADGES[selectedItem.status].text)}>
                  {STATUS_BADGES[selectedItem.status].label}
                </span>
                <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", SEVERITY_BADGES[selectedItem.severity].bg, SEVERITY_BADGES[selectedItem.severity].text)}>
                  {SEVERITY_BADGES[selectedItem.severity].label}
                </span>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <h2 className="text-xl font-bold text-foreground">{selectedItem.title}</h2>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-rose-500" />
                  {selectedItem.location_detail}
                </p>
              </div>

              {/* Full-size Annotated Canvas */}
              {selectedItem.photo_path ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-foreground">Defect Site Photo & Canvas Markup:</p>
                  <PunchItemAnnotator
                    photoUrl={selectedItem.photo_path}
                    initialShapes={selectedItem.annotation_data || []}
                    readOnly={true}
                    className="w-full"
                  />
                </div>
              ) : (
                <div className="p-8 text-center bg-muted/30 rounded-xl border border-border text-muted-foreground text-xs font-medium">
                  No visual photo attached for this punch item.
                </div>
              )}

              {/* Description & Remediation Details */}
              <div className="space-y-2 bg-secondary/40 p-4 rounded-xl border border-border">
                <p className="text-xs font-semibold text-foreground">Defect Description & Remediation Scope:</p>
                <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedItem.description}
                </p>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-border pt-4">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Logged By:</span>
                  <span className="font-semibold text-foreground">{selectedItem.creator?.full_name || selectedItem.creator?.email || "Staff"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Assigned To:</span>
                  <span className="font-semibold text-foreground">{selectedItem.assignee?.full_name || selectedItem.assignee?.email || "Unassigned"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Date Created:</span>
                  <span className="font-semibold text-foreground">{new Date(selectedItem.created_at).toLocaleDateString("en-IN")}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Date Resolved:</span>
                  <span className="font-semibold text-foreground">{selectedItem.resolved_at ? new Date(selectedItem.resolved_at).toLocaleDateString("en-IN") : "Pending"}</span>
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">Update Remediation Status:</span>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => handleStatusChange(selectedItem, "open")}
                    disabled={isSubmitting || selectedItem.status === "open"}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border",
                      selectedItem.status === "open"
                        ? "bg-rose-500 text-white border-rose-500 shadow-xs"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    Open
                  </button>

                  <button
                    onClick={() => handleStatusChange(selectedItem, "in_progress")}
                    disabled={isSubmitting || selectedItem.status === "in_progress"}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border",
                      selectedItem.status === "in_progress"
                        ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    In Progress
                  </button>

                  <button
                    onClick={() => handleStatusChange(selectedItem, "resolved")}
                    disabled={isSubmitting || selectedItem.status === "resolved"}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border",
                      selectedItem.status === "resolved"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    Resolved
                  </button>

                  <button
                    onClick={() => handleStatusChange(selectedItem, "verified")}
                    disabled={isSubmitting || selectedItem.status === "verified"}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all border",
                      selectedItem.status === "verified"
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-background text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    Verified QA
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
