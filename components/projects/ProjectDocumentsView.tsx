"use client";

import { useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Trash2,
  Plus,
  Filter,
  Loader2,
  AlertTriangle,
  X,
  ExternalLink,
  FolderOpen,
  Link2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getDocumentSignedUrl,
  deleteProjectDocument,
  type ProjectDocumentItem,
} from "@/lib/queries/documents";
import { UploadDocumentModal } from "./UploadDocumentModal";
import type { DocumentCategory, UserRole } from "@/types/database";
import { cn } from "@/lib/utils";

interface ProjectDocumentsViewProps {
  initialDocuments: ProjectDocumentItem[];
  projectId: string;
  userId: string;
  userRole: UserRole;
}

const CATEGORY_CONFIG: Record<DocumentCategory, { label: string; bg: string; text: string }> = {
  drawing:  { label: "Drawing",  bg: "bg-indigo-100 dark:bg-indigo-950/60", text: "text-indigo-800 dark:text-indigo-300" },
  contract: { label: "Contract", bg: "bg-amber-100 dark:bg-amber-950/60",   text: "text-amber-800 dark:text-amber-300" },
  report:   { label: "Report",   bg: "bg-emerald-100 dark:bg-emerald-950/60",text: "text-emerald-800 dark:text-emerald-300" },
  photo:    { label: "Photo",    bg: "bg-violet-100 dark:bg-violet-950/60", text: "text-violet-800 dark:text-violet-300" },
  other:    { label: "Other",    bg: "bg-slate-100 dark:bg-slate-800",       text: "text-slate-700 dark:text-slate-300" },
};

function getFileIcon(fileName: string, mimeType: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf" || mimeType.includes("pdf")) {
    return <FileText className="w-5 h-5 text-rose-500" />;
  }
  if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext) || mimeType.includes("image")) {
    return <ImageIcon className="w-5 h-5 text-indigo-500" />;
  }
  if (["xlsx", "xls", "csv"].includes(ext) || mimeType.includes("sheet") || mimeType.includes("excel")) {
    return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
  }
  if (ext === "dwg" || ext === "cad") {
    return <FileCode className="w-5 h-5 text-violet-500" />;
  }

  return <File className="w-5 h-5 text-amber-500" />;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProjectDocumentsView({
  initialDocuments,
  projectId,
  userId,
  userRole,
}: ProjectDocumentsViewProps) {
  const supabase = createClient();

  const [documents, setDocuments] = useState<ProjectDocumentItem[]>(initialDocuments);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Delete modal state
  const [docToDelete, setDocToDelete] = useState<ProjectDocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedDiffId, setExpandedDiffId] = useState<string | null>(null);

  const filteredDocuments = documents.filter(
    (d) => categoryFilter === "all" || d.category === categoryFilter
  );

  const handleDownload = async (doc: ProjectDocumentItem) => {
    setDownloadingId(doc.id);
    setErrorMsg(null);

    const res = await getDocumentSignedUrl(supabase, doc.file_path);
    setDownloadingId(null);

    if (res.error || !res.signedUrl) {
      setErrorMsg(res.error || "Failed to generate signed download link.");
    } else {
      // Open in new tab or trigger browser download
      window.open(res.signedUrl, "_blank");
    }
  };

  const handleConfirmDelete = async () => {
    if (!docToDelete) return;

    setIsDeleting(true);
    setErrorMsg(null);

    // Deletes storage object first, then DB record
    const res = await deleteProjectDocument(supabase, docToDelete.id, docToDelete.file_path);
    setIsDeleting(false);

    if (!res.success) {
      setErrorMsg(res.error || "Failed to delete document.");
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      setDocToDelete(null);
    }
  };

  const handleUploadSuccess = (
    newDoc: ProjectDocumentItem,
    diffTrigger?: { file: File; supersedesId: string }
  ) => {
    setDocuments((prev) => [
      diffTrigger ? { ...newDoc, diff_status: "pending" } : newDoc,
      ...prev,
    ]);

    if (diffTrigger) {
      triggerDocumentDiff(newDoc.id, diffTrigger.supersedesId, diffTrigger.file);
    }
  };

  const triggerDocumentDiff = async (documentId: string, supersedesId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("documentId", documentId);
      formData.append("supersedesDocumentId", supersedesId);

      const res = await fetch("/api/ai/document-diff", { method: "POST", body: formData });
      const result = await res.json().catch(() => ({}));

      if (!res.ok || result.skipped) {
        setDocuments((prev) =>
          prev.map((d) => (d.id === documentId ? { ...d, diff_status: result.skipped ? null : "failed" } : d))
        );
        return;
      }

      setDocuments((prev) =>
        prev.map((d) =>
          d.id === documentId ? { ...d, diff_status: "complete", diff_summary: result.summary } : d
        )
      );
    } catch {
      setDocuments((prev) => prev.map((d) => (d.id === documentId ? { ...d, diff_status: "failed" } : d)));
    }
  };

  return (
    <div className="space-y-6">
      {/* Global Error Banner */}
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

      {/* Action & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">All Categories</option>
              <option value="drawing">Drawings</option>
              <option value="contract">Contracts</option>
              <option value="report">Reports</option>
              <option value="photo">Photos</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={() => setShowUploadModal(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Upload Document
        </button>
      </div>

      {/* Documents Grid / Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/50 border-b border-border text-muted-foreground uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-5 py-3.5">Document File</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Size</th>
                <th className="px-5 py-3.5">Uploaded By</th>
                <th className="px-5 py-3.5">Uploaded Date</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDocuments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-muted-foreground">
                    <FolderOpen className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="font-semibold text-foreground">No project documents uploaded yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Upload architectural drawings, legal contracts, or site reports.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredDocuments.map((doc) => {
                  const catCfg = CATEGORY_CONFIG[doc.category] || CATEGORY_CONFIG.other;
                  const canDelete =
                    doc.uploaded_by === userId ||
                    userRole === "admin" ||
                    userRole === "project_manager";

                  return (
                    <tr key={doc.id} className="hover:bg-muted/40 transition-colors">
                      {/* Document File Name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                            {getFileIcon(doc.file_name, doc.file_type)}
                          </div>
                          <div className="min-w-0 max-w-xs">
                            <p className="font-semibold text-foreground truncate">{doc.file_name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase mt-0.5">
                              {doc.file_name.split(".").pop()}
                            </p>
                            {doc.supersedes?.file_name && (
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1 truncate">
                                <Link2 className="w-2.5 h-2.5 shrink-0" />
                                Replaces &quot;{doc.supersedes.file_name}&quot;
                              </p>
                            )}
                            {doc.diff_status === "pending" && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                Comparing…
                              </p>
                            )}
                            {doc.diff_status === "complete" && (
                              <button
                                type="button"
                                onClick={() => setExpandedDiffId(expandedDiffId === doc.id ? null : doc.id)}
                                className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5 flex items-center gap-1 font-semibold hover:text-indigo-700 dark:hover:text-indigo-300"
                              >
                                <Sparkles className="w-2.5 h-2.5" />
                                What changed
                                {expandedDiffId === doc.id ? (
                                  <ChevronUp className="w-2.5 h-2.5" />
                                ) : (
                                  <ChevronDown className="w-2.5 h-2.5" />
                                )}
                              </button>
                            )}
                            {doc.diff_status === "failed" && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">Comparison failed</p>
                            )}
                            {doc.diff_status === "complete" && expandedDiffId === doc.id && (
                              <p className="text-[11px] text-foreground/80 leading-relaxed mt-1.5 p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900 whitespace-normal max-w-xs">
                                {doc.diff_summary}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category Badge */}
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-block px-2.5 py-1 rounded-md text-xs font-semibold",
                            catCfg.bg,
                            catCfg.text
                          )}
                        >
                          {catCfg.label}
                        </span>
                      </td>

                      {/* Formatted File Size */}
                      <td className="px-5 py-3.5 font-medium text-foreground">
                        {formatFileSize(doc.file_size)}
                      </td>

                      {/* Uploaded By */}
                      <td className="px-5 py-3.5 text-muted-foreground font-medium">
                        {doc.uploader?.full_name || doc.uploader?.email || "User"}
                      </td>

                      {/* Uploaded Date */}
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {new Date(doc.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* Download Button */}
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloadingId === doc.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:hover:bg-indigo-950/80 transition-all border border-indigo-200 dark:border-indigo-800"
                            title="Generate signed download link"
                          >
                            {downloadingId === doc.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Download className="w-3.5 h-3.5" />
                            )}
                            Download
                          </button>

                          {/* Delete Button */}
                          {canDelete && (
                            <button
                              onClick={() => setDocToDelete(doc)}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400 dark:hover:bg-rose-950/40 transition-all"
                              title="Delete document"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={showUploadModal}
        projectId={projectId}
        userId={userId}
        existingDocuments={documents}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Delete Modal */}
      {docToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setDocToDelete(null)}
        >
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="w-4.5 h-4.5" />
                Delete Project Document
              </h3>
              <button onClick={() => setDocToDelete(null)} className="p-1 text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-foreground">
                Are you sure you want to delete <span className="font-bold">{docToDelete.file_name}</span>?
              </p>

              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300">
                This will permanently delete the private storage object and remove its database metadata.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDocToDelete(null)}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-all shadow-xs"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Permanently Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
