"use client";

import { useState } from "react";
import { UploadCloud, Loader2, X, AlertTriangle, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { uploadDocumentRecord, type ProjectDocumentItem } from "@/lib/queries/documents";
import type { DocumentCategory } from "@/types/database";

interface UploadDocumentModalProps {
  isOpen: boolean;
  projectId: string;
  userId: string;
  onClose: () => void;
  onSuccess: (newDocument: ProjectDocumentItem) => void;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB Guard

const ALLOWED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "docx",
  "xlsx",
  "dwg",
  "txt",
];

const CATEGORY_OPTIONS: { value: DocumentCategory; label: string }[] = [
  { value: "drawing",  label: "Architectural & Structural Drawing" },
  { value: "contract", label: "Legal Contract & Agreement" },
  { value: "report",   label: "Site Inspection & Quality Report" },
  { value: "photo",    label: "Site Progress Photo" },
  { value: "other",    label: "Other Document" },
];

export function UploadDocumentModal({
  isOpen,
  projectId,
  userId,
  onClose,
  onSuccess,
}: UploadDocumentModalProps) {
  const supabase = createClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<DocumentCategory>("drawing");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (file: File | null) => {
    setErrorMsg(null);
    if (!file) {
      setSelectedFile(null);
      return;
    }

    // 1. Check size guard (Max 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(`File size exceeds max limit of 10MB (${(file.size / (1024 * 1024)).toFixed(1)}MB selected).`);
      setSelectedFile(null);
      return;
    }

    // 2. Check extension guard
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMsg(`Disallowed file type (.${ext}). Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg("Please select a valid document file.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const timeStamp = Date.now();
    const sanitizedFileName = selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${projectId}/${timeStamp}_${sanitizedFileName}`;

    try {
      // 1. Upload to Supabase Private Storage Bucket 'project-documents'
      const { error: storageErr } = await supabase.storage
        .from("project-documents")
        .upload(filePath, selectedFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (storageErr) {
        setIsSubmitting(false);
        setErrorMsg("Storage upload failed: " + storageErr.message);
        return;
      }

      // 2. Insert Database Record
      const res = await uploadDocumentRecord(supabase, {
        project_id: projectId,
        file_name: selectedFile.name,
        file_path: filePath,
        file_type: selectedFile.type || "application/octet-stream",
        file_size: selectedFile.size,
        category,
        uploaded_by: userId,
      });

      setIsSubmitting(false);

      if (!res.success || !res.document) {
        setErrorMsg(res.error || "Failed to record document metadata.");
      } else {
        onSuccess(res.document);
        resetForm();
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err.message || "Error uploading document.");
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setCategory("drawing");
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
            <UploadCloud className="w-4.5 h-4.5 text-primary" />
            Upload Project Document
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
            <label className="block text-xs font-semibold text-foreground mb-1">Document Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          {/* File Dropzone Picker */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">Select File (Max 10MB)</label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary rounded-xl p-6 cursor-pointer bg-secondary/30 transition-colors">
              <UploadCloud className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-xs font-semibold text-foreground">
                {selectedFile ? selectedFile.name : "Click to browse or drop file here"}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">
                Supported: PDF, PNG, JPG, DOCX, XLSX, DWG (up to 10MB)
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.dwg,.txt"
                onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              />
            </label>

            {selectedFile && (
              <div className="mt-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  <span className="truncate">{selectedFile.name}</span>
                </div>
                <span className="text-[11px] text-emerald-600 shrink-0 ml-2">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            )}
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
              disabled={isSubmitting || !selectedFile}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-sm disabled:opacity-50"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Upload Document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
