"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Plus,
  X,
  Loader2,
  Upload,
  AlertTriangle,
  Clock,
} from "lucide-react";
import {
  createWarrantyClaim,
  updateWarrantyClaimStatus,
  setProjectWarrantyEndDate,
  type WarrantyClaim,
  type WarrantyClaimStatus,
} from "@/lib/queries/warranty";
import { uploadPunchPhoto, type AnnotationShape } from "@/lib/queries/punch_list";
import { PunchItemAnnotator } from "@/components/projects/PunchItemAnnotator";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

interface WarrantyClaimsViewProps {
  projectId: string;
  initialClaims: WarrantyClaim[];
  userId: string;
  /** Staff (admin/pm/site_staff) can acknowledge/resolve/reject; a client can only submit and view. */
  canManage: boolean;
  warrantyEndDate?: string | null;
}

const STATUS_BADGES: Record<WarrantyClaimStatus, { label: string; bg: string; text: string }> = {
  submitted: { label: "Submitted", bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300" },
  acknowledged: { label: "Acknowledged", bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  in_progress: { label: "In Progress", bg: "bg-amber-100 dark:bg-amber-950/60", text: "text-amber-800 dark:text-amber-300" },
  resolved: { label: "Resolved", bg: "bg-emerald-100 dark:bg-emerald-950/60", text: "text-emerald-800 dark:text-emerald-300" },
  rejected: { label: "Rejected", bg: "bg-rose-100 dark:bg-rose-950/60", text: "text-rose-800 dark:text-rose-300" },
};

const NEXT_STATUS: Partial<Record<WarrantyClaimStatus, WarrantyClaimStatus>> = {
  submitted: "acknowledged",
  acknowledged: "in_progress",
  in_progress: "resolved",
};

export function WarrantyClaimsView({ projectId, initialClaims, userId, canManage, warrantyEndDate }: WarrantyClaimsViewProps) {
  const supabase = createClient();
  const [claims, setClaims] = useState<WarrantyClaim[]>(initialClaims);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [pinShapes, setPinShapes] = useState<AnnotationShape[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editedWarrantyEndDate, setEditedWarrantyEndDate] = useState(warrantyEndDate || "");
  const [currentWarrantyEndDate, setCurrentWarrantyEndDate] = useState(warrantyEndDate || null);
  const [isSavingWarrantyDate, setIsSavingWarrantyDate] = useState(false);

  const isWarrantyExpired = currentWarrantyEndDate ? new Date(currentWarrantyEndDate) < new Date() : false;

  const handleSaveWarrantyEndDate = async () => {
    setIsSavingWarrantyDate(true);
    const res = await setProjectWarrantyEndDate(supabase, projectId, editedWarrantyEndDate || null);
    setIsSavingWarrantyDate(false);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to update warranty end date.");
      return;
    }
    setCurrentWarrantyEndDate(editedWarrantyEndDate || null);
  };

  function resetForm() {
    setTitle("");
    setDescription("");
    setLocationDetail("");
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(null);
    setPhotoPreviewUrl(null);
    setPinShapes([]);
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("Photo exceeds 10MB limit.");
      return;
    }
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg("Invalid file type. Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    setErrorMsg(null);
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
    setPinShapes([]);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim() || !description.trim() || !locationDetail.trim()) {
      setErrorMsg("Title, description, and location are all required.");
      return;
    }

    setIsSubmitting(true);

    let photoPath: string | null = null;
    if (photoFile) {
      const uploadRes = await uploadPunchPhoto(supabase, photoFile);
      if (uploadRes.error) {
        setErrorMsg(`Photo upload failed: ${uploadRes.error}`);
        setIsSubmitting(false);
        return;
      }
      photoPath = uploadRes.publicUrl || null;
    }

    const res = await createWarrantyClaim(
      supabase,
      {
        project_id: projectId,
        title: title.trim(),
        description: description.trim(),
        location_detail: locationDetail.trim(),
        photo_path: photoPath,
        annotation_data: pinShapes.length > 0 ? [pinShapes[pinShapes.length - 1]] : null,
      },
      userId
    );

    setIsSubmitting(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.error || "Failed to submit warranty claim.");
      return;
    }

    setClaims((prev) => [res.data!, ...prev]);
    resetForm();
    setIsAddModalOpen(false);
  };

  const handleAdvanceStatus = async (claim: WarrantyClaim) => {
    const next = NEXT_STATUS[claim.status];
    if (!next) return;
    setUpdatingId(claim.id);
    const res = await updateWarrantyClaimStatus(supabase, claim.id, next);
    setUpdatingId(null);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to update claim.");
      return;
    }
    setClaims((prev) =>
      prev.map((c) => (c.id === claim.id ? { ...c, status: next, resolved_at: next === "resolved" ? new Date().toISOString() : c.resolved_at } : c))
    );
  };

  const handleReject = async (claim: WarrantyClaim) => {
    setUpdatingId(claim.id);
    const res = await updateWarrantyClaimStatus(supabase, claim.id, "rejected");
    setUpdatingId(null);
    if (!res.success) {
      setErrorMsg(res.error || "Failed to reject claim.");
      return;
    }
    setClaims((prev) => prev.map((c) => (c.id === claim.id ? { ...c, status: "rejected", resolved_at: new Date().toISOString() } : c)));
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-300 text-xs font-medium flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-xs underline">Dismiss</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Warranty Claims
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {currentWarrantyEndDate
              ? `Warranty period ${isWarrantyExpired ? "ended" : "active until"} ${new Date(currentWarrantyEndDate).toLocaleDateString("en-IN")}`
              : "Post-handover defect claims for this project."}
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-indigo-500/20 transition-all shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Report Warranty Issue
        </button>
      </div>

      {canManage && (
        <div className="flex items-center gap-2 p-3 bg-secondary/40 border border-border rounded-xl text-xs">
          <label className="font-semibold text-foreground shrink-0">Warranty End Date:</label>
          <input
            type="date"
            value={editedWarrantyEndDate}
            onChange={(e) => setEditedWarrantyEndDate(e.target.value)}
            className="px-2.5 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            onClick={handleSaveWarrantyEndDate}
            disabled={isSavingWarrantyDate || editedWarrantyEndDate === (currentWarrantyEndDate || "")}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold bg-card border border-border hover:bg-secondary text-foreground rounded-lg disabled:opacity-50 transition-all"
          >
            {isSavingWarrantyDate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
        </div>
      )}

      {isWarrantyExpired && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          This project&apos;s warranty period has ended — new claims can still be logged for reference but may fall outside coverage.
        </div>
      )}

      {claims.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">No warranty claims logged</p>
          <p className="text-xs text-muted-foreground mt-1">Report an issue that showed up after handover.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {claims.map((claim) => {
            const statusCfg = STATUS_BADGES[claim.status];
            const next = NEXT_STATUS[claim.status];
            return (
              <div key={claim.id} className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs flex flex-col">
                <div className="relative h-40 bg-slate-900 overflow-hidden shrink-0">
                  {claim.photo_path ? (
                    <PunchItemAnnotator
                      photoUrl={claim.photo_path}
                      initialShapes={claim.annotation_data || []}
                      readOnly
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <ShieldCheck className="w-8 h-8" />
                    </div>
                  )}
                  <span className={cn("absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-xs", statusCfg.bg, statusCfg.text)}>
                    {statusCfg.label}
                  </span>
                </div>
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-foreground text-sm line-clamp-1">{claim.title}</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{claim.location_detail}</p>
                    <p className="text-xs text-muted-foreground/90 line-clamp-2 pt-1">{claim.description}</p>
                    {claim.resolution_notes && (
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400 pt-1">Resolution: {claim.resolution_notes}</p>
                    )}
                  </div>
                  <div className="pt-2 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(claim.created_at).toLocaleDateString("en-IN")}
                    </span>
                    {canManage && (next || claim.status !== "rejected" && claim.status !== "resolved") && (
                      <div className="flex items-center gap-2">
                        {next && (
                          <button
                            onClick={() => handleAdvanceStatus(claim)}
                            disabled={updatingId === claim.id}
                            className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 font-semibold disabled:opacity-50"
                          >
                            {STATUS_BADGES[next].label}
                          </button>
                        )}
                        {claim.status !== "resolved" && claim.status !== "rejected" && (
                          <button
                            onClick={() => handleReject(claim)}
                            disabled={updatingId === claim.id}
                            className="text-rose-600 dark:text-rose-400 hover:text-rose-500 font-semibold disabled:opacity-50"
                          >
                            Reject
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30 shrink-0">
              <h3 className="font-bold text-foreground text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-indigo-600" /> Report Warranty Issue
              </h3>
              <button onClick={() => { resetForm(); setIsAddModalOpen(false); }} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Water Seepage Near Balcony Door"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Location <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  placeholder="e.g. 3rd Floor, Master Bedroom Balcony"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you're seeing…"
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">Photo (Optional)</label>
                {!photoPreviewUrl ? (
                  <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-indigo-500/60 hover:bg-secondary/40 cursor-pointer transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    Upload a photo and mark the spot
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                ) : (
                  <div className="space-y-1.5">
                    <PunchItemAnnotator
                      photoUrl={photoPreviewUrl}
                      initialShapes={pinShapes}
                      onChange={(shapes) => setPinShapes(shapes.slice(-1))}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(photoPreviewUrl);
                        setPhotoFile(null);
                        setPhotoPreviewUrl(null);
                        setPinShapes([]);
                      }}
                      className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline"
                    >
                      Remove photo
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => { resetForm(); setIsAddModalOpen(false); }}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-sm disabled:opacity-60"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit Claim
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
