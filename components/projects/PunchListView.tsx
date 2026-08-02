"use client";

import { useState, useRef } from "react";
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
  Upload,
  Image as ImageIcon,
  Check,
} from "lucide-react";
import {
  createPunchItem,
  updatePunchItemStatus,
  uploadPunchPhoto,
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

// High-quality construction defect sample images for quick demonstration
const SAMPLE_CONSTRUCTION_PHOTOS = [
  {
    label: "Sample 1: Rebar & Concrete Defect",
    url: "https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "Sample 2: Wall Plaster Surface Crack",
    url: "https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80",
  },
  {
    label: "Sample 3: Doorway & Frame Misalignment",
    url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80",
  },
];

export function PunchListView({
  projectId,
  initialItems,
  user,
  teamMembers = [],
}: PunchListViewProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Photo Source Selection: "upload" (Primary) or "sample"
  const [photoSourceMode, setPhotoSourceMode] = useState<"upload" | "sample">("upload");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedFilePreview, setUploadedFilePreview] = useState<string | null>(null);
  const [samplePhotoUrl, setSamplePhotoUrl] = useState<string>(SAMPLE_CONSTRUCTION_PHOTOS[0].url);

  const [annotationData, setAnnotationData] = useState<AnnotationShape[]>([
    { type: "circle", x: 0.45, y: 0.4, radius: 0.12 },
    { type: "arrow", x: 0.2, y: 0.25, endX: 0.42, endY: 0.38 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active photo URL passed to PunchItemAnnotator canvas
  const activePhotoUrl = photoSourceMode === "upload" && uploadedFilePreview ? uploadedFilePreview : samplePhotoUrl;

  // Handle local file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File size exceeds 10MB limit.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }

    setErrorMsg(null);
    setUploadedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setUploadedFilePreview(objectUrl);
    setPhotoSourceMode("upload");
  };

  // Compute metrics
  const totalCount = items.length;
  const openCount = items.filter((i) => i.status === "open").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const resolvedCount = items.filter((i) => i.status === "resolved" || i.status === "verified").length;

  // Filter items
  const filteredItems = items.filter((item) => {
    if (severityFilter !== "all" && item.severity !== severityFilter) return false;
    if (statusFilter !== "all" && item.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchLoc = item.location_detail.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      return matchTitle || matchLoc || matchDesc;
    }
    return true;
  });

  const handleOpenAddModal = () => {
    setTitle("");
    setDescription("");
    setLocationDetail("");
    setSeverity("moderate");
    setAssignedTo("");
    setUploadedFile(null);
    setUploadedFilePreview(null);
    setPhotoSourceMode("upload");
    setSamplePhotoUrl(SAMPLE_CONSTRUCTION_PHOTOS[0].url);
    setAnnotationData([
      { type: "circle", x: 0.45, y: 0.4, radius: 0.12 },
      { type: "arrow", x: 0.2, y: 0.25, endX: 0.42, endY: 0.38 },
    ]);
    setErrorMsg(null);
    setIsAddModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || !locationDetail.trim() || !description.trim()) {
      setErrorMsg("Please complete all required fields.");
      return;
    }

    if (photoSourceMode === "upload" && !uploadedFile && !uploadedFilePreview) {
      setErrorMsg("Please upload a defect site photo or select a construction sample photo.");
      return;
    }

    setIsSubmitting(true);

    let finalPhotoPath = samplePhotoUrl;

    if (photoSourceMode === "upload" && uploadedFile) {
      const uploadRes = await uploadPunchPhoto(supabase, uploadedFile);
      if (uploadRes.publicUrl) {
        finalPhotoPath = uploadRes.publicUrl;
      }
    }

    const res = await createPunchItem(
      supabase,
      {
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        location_detail: locationDetail.trim(),
        severity,
        photo_path: finalPhotoPath,
        annotation_data: annotationData,
        assigned_to: assignedTo || null,
      },
      user.id
    );

    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.error || "Failed to create punch list item.");
    } else {
      setItems((prev) => [res.data!, ...prev]);
      setIsAddModalOpen(false);
      setSuccessMsg("Quality punch defect logged successfully with vector canvas markup.");
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const handleStatusChange = async (itemId: string, newStatus: PunchItemStatus) => {
    setIsSubmitting(true);
    setErrorMsg(null);

    const res = await updatePunchItemStatus(supabase, itemId, newStatus);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to update item status.");
    } else {
      setItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                status: newStatus,
                resolved_at: newStatus === "resolved" || newStatus === "verified" ? new Date().toISOString() : null,
              }
            : i
        )
      );

      if (selectedItem?.id === itemId) {
        setSelectedItem((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-xl">
            <AlertOctagon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Total Punch Items</p>
            <p className="text-xl font-bold text-foreground">{totalCount}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Open Snags</p>
            <p className="text-xl font-bold text-rose-600 dark:text-rose-400">{openCount}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">In Progress Rework</p>
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{inProgressCount}</p>
          </div>
        </div>

        <div className="bg-card border border-border p-4 rounded-2xl shadow-xs flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Resolved & Verified</p>
            <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{resolvedCount}</p>
          </div>
        </div>
      </div>

      {/* Action & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <input
            type="text"
            placeholder="Search punch title, grid location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3.5 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500 w-full sm:w-64"
          />

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Severities</option>
            <option value="minor">Minor</option>
            <option value="moderate">Moderate</option>
            <option value="major">Major</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="verified">Verified QA</option>
          </select>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-500/20 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Log Quality Punch Item
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Punch Items Cards Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-xs">
          <AlertOctagon className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-foreground">No Punch List Items Found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            No defect snagging items match your filter selection. Click &quot;Log Quality Punch Item&quot; to capture site defects with photo vector annotations.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const sevCfg = SEVERITY_BADGES[item.severity] || SEVERITY_BADGES.minor;
            const statusCfg = STATUS_BADGES[item.status] || STATUS_BADGES.open;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs hover:border-rose-500/40 transition-all cursor-pointer flex flex-col justify-between group"
              >
                {/* Photo Header with Canvas Overlay */}
                <div className="relative h-48 bg-slate-900 overflow-hidden shrink-0">
                  {item.photo_path ? (
                    <PunchItemAnnotator
                      photoUrl={item.photo_path}
                      initialShapes={item.annotation_data || []}
                      readOnly={true}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <FileImage className="w-8 h-8" />
                    </div>
                  )}

                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs", sevCfg.bg, sevCfg.text)}>
                      {sevCfg.label}
                    </span>
                  </div>

                  <div className="absolute top-3 right-3">
                    <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs", statusCfg.bg, statusCfg.text)}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                {/* Content Body */}
                <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <h4 className="font-bold text-foreground text-sm group-hover:text-rose-600 transition-colors line-clamp-1">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                      <span className="truncate">{item.location_detail}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/90 line-clamp-2 pt-1 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>
                      Logged by <strong>{item.creator?.full_name || "Site Engineer"}</strong>
                    </span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold group-hover:underline flex items-center gap-0.5">
                      Inspect & Action →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE PUNCH ITEM MODAL WITH REAL PHOTO UPLOADER */}
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
              {/* Photo Upload & Source Selection Header */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-semibold text-foreground">
                    Defect Site Photo & Canvas Vector Markup <span className="text-rose-500">*</span>
                  </label>

                  <div className="flex items-center gap-1 bg-secondary p-1 rounded-xl text-xs shrink-0">
                    <button
                      type="button"
                      onClick={() => setPhotoSourceMode("upload")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                        photoSourceMode === "upload" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Upload className="w-3.5 h-3.5 text-rose-500" />
                      Upload Site Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoSourceMode("sample")}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all",
                        photoSourceMode === "sample" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      Sample Construction Photo
                    </button>
                  </div>
                </div>

                {/* Primary Upload Input */}
                {photoSourceMode === "upload" ? (
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="p-4 border-2 border-dashed border-border hover:border-rose-500/60 rounded-2xl bg-secondary/20 hover:bg-secondary/40 transition-all cursor-pointer text-center space-y-2 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">
                          {uploadedFile ? uploadedFile.name : "Click to Browse or Drop Site Defect Photo"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {uploadedFile ? `${(uploadedFile.size / (1024 * 1024)).toFixed(2)} MB • Ready for canvas markup` : "Accepts JPG, PNG, WEBP up to 10MB"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Secondary Sample Selector */
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {SAMPLE_CONSTRUCTION_PHOTOS.map((sample, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSamplePhotoUrl(sample.url)}
                        className={cn(
                          "p-2 rounded-xl border text-left flex items-center gap-2 text-xs transition-all",
                          samplePhotoUrl === sample.url ? "border-rose-500 bg-rose-500/5 font-bold" : "border-border bg-secondary/20 text-muted-foreground"
                        )}
                      >
                        <ImageIcon className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="truncate">{sample.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Canvas Vector Annotator */}
                {activePhotoUrl && (
                  <div className="pt-2">
                    <PunchItemAnnotator
                      photoUrl={activePhotoUrl}
                      initialShapes={annotationData}
                      onChange={(shapes) => setAnnotationData(shapes)}
                    />
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Use Circle, Arrow, or Pin tools above to mark exact snag location directly on the photo canvas.
                    </p>
                  </div>
                )}
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
                    placeholder="e.g. Concrete Honeycombing on Column C-4"
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
                    placeholder="e.g. Level 3, Grid C-4 Core Wall"
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

      {/* DETAIL & STATUS TRANSITION MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-foreground text-base line-clamp-1">{selectedItem.title}</h3>
              </div>
              <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Photo & Vector Markup View */}
              <div className="h-80 bg-slate-900 rounded-2xl overflow-hidden relative border border-border">
                {selectedItem.photo_path ? (
                  <PunchItemAnnotator
                    photoUrl={selectedItem.photo_path}
                    initialShapes={selectedItem.annotation_data || []}
                    readOnly={true}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-500">
                    No photo uploaded.
                  </div>
                )}
              </div>

              {/* Status & Lifecycle Actions */}
              <div className="p-4 rounded-xl bg-secondary/50 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] text-muted-foreground block font-semibold">Current Lifecycle Status:</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={cn("px-3 py-1 rounded-full text-xs font-bold", STATUS_BADGES[selectedItem.status].bg, STATUS_BADGES[selectedItem.status].text)}>
                      {STATUS_BADGES[selectedItem.status].label}
                    </span>
                    {selectedItem.resolved_at && (
                      <span className="text-[11px] text-muted-foreground">
                        (Resolved on {new Date(selectedItem.resolved_at).toLocaleDateString("en-IN")})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {selectedItem.status === "open" && (
                    <button
                      onClick={() => handleStatusChange(selectedItem.id, "in_progress")}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Start Rework (In Progress)
                    </button>
                  )}

                  {selectedItem.status === "in_progress" && (
                    <button
                      onClick={() => handleStatusChange(selectedItem.id, "resolved")}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-xs"
                    >
                      Mark Resolved
                    </button>
                  )}

                  {selectedItem.status === "resolved" && (
                    <button
                      onClick={() => handleStatusChange(selectedItem.id, "verified")}
                      disabled={isSubmitting}
                      className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Verify QA Sign-off
                    </button>
                  )}
                </div>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium block">Grid Location Detail:</span>
                  <p className="font-semibold text-foreground">{selectedItem.location_detail}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium block">Defect Severity:</span>
                  <span className={cn("inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold", SEVERITY_BADGES[selectedItem.severity].bg, SEVERITY_BADGES[selectedItem.severity].text)}>
                    {SEVERITY_BADGES[selectedItem.severity].label}
                  </span>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium block">Logged By:</span>
                  <p className="font-semibold text-foreground">{selectedItem.creator?.full_name || "Site Staff"}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-muted-foreground font-medium block">Assigned Remediation Team:</span>
                  <p className="font-semibold text-foreground">{selectedItem.assignee?.full_name || "Unassigned"}</p>
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-border">
                <span className="text-muted-foreground font-medium block text-xs">Description & Remediation Instructions:</span>
                <p className="text-xs text-foreground bg-muted/30 p-3 rounded-xl border border-border leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
