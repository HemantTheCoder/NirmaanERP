import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, DocumentCategory, DocumentDiffStatus } from "@/types/database";

export interface ProjectDocumentItem {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: DocumentCategory;
  uploaded_by: string;
  created_at: string;
  /** The document this one replaces, if it's a new version of an existing upload. */
  supersedes_document_id: string | null;
  diff_summary: string | null;
  diff_status: DocumentDiffStatus | null;
  uploader?: {
    full_name: string | null;
    email: string;
  };
  /** Filename of the document this one supersedes, for a "Replaces X" badge without a second query. */
  supersedes?: {
    file_name: string;
  } | null;
}

export interface UploadDocumentRecordPayload {
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: DocumentCategory;
  uploaded_by: string;
  supersedes_document_id?: string | null;
}

/**
 * Fetch all documents for a project with uploader details
 */
export async function getProjectDocuments(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ProjectDocumentItem[]> {
  const { data, error } = await (supabase.from("project_documents") as any)
    .select(`
      *,
      uploader:users!project_documents_uploaded_by_fkey(full_name, email),
      supersedes:supersedes_document_id(file_name)
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    console.error("Error fetching project documents:", error);
    return [];
  }

  return data as ProjectDocumentItem[];
}

/**
 * Insert document metadata record into DB after storage upload
 */
export async function uploadDocumentRecord(
  supabase: SupabaseClient<Database>,
  payload: UploadDocumentRecordPayload
): Promise<{ success: boolean; error?: string; document?: ProjectDocumentItem }> {
  const { data, error } = await (supabase.from("project_documents") as any)
    .insert({
      project_id: payload.project_id,
      file_name: payload.file_name,
      file_path: payload.file_path,
      file_type: payload.file_type,
      file_size: payload.file_size,
      category: payload.category,
      uploaded_by: payload.uploaded_by,
      supersedes_document_id: payload.supersedes_document_id ?? null,
    })
    .select(`
      *,
      uploader:users!project_documents_uploaded_by_fkey(full_name, email),
      supersedes:supersedes_document_id(file_name)
    `)
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || "Failed to record document metadata" };
  }

  return { success: true, document: data as ProjectDocumentItem };
}

/**
 * Generate a short-lived (60-second expiry) signed URL for secure private download
 */
export async function getDocumentSignedUrl(
  supabase: SupabaseClient<Database>,
  filePath: string
): Promise<{ signedUrl?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from("project-documents")
    .createSignedUrl(filePath, 60);

  if (error || !data?.signedUrl) {
    return { error: error?.message || "Failed to generate signed download link" };
  }

  return { signedUrl: data.signedUrl };
}

/**
 * Delete document: removes storage object first, then DB record
 */
export async function deleteProjectDocument(
  supabase: SupabaseClient<Database>,
  documentId: string,
  filePath: string
): Promise<{ success: boolean; error?: string }> {
  // 1. Remove object from storage bucket first
  const { error: storageErr } = await supabase.storage
    .from("project-documents")
    .remove([filePath]);

  if (storageErr) {
    console.warn("Storage deletion error (proceeding to remove DB row if file missing):", storageErr.message);
  }

  // 2. Delete database metadata record
  const { error: dbErr } = await (supabase.from("project_documents") as any)
    .delete()
    .eq("id", documentId);

  if (dbErr) {
    return { success: false, error: "Failed to delete document record: " + dbErr.message };
  }

  return { success: true };
}
