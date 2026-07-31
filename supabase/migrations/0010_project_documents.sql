-- =============================================================================
-- Nirmaan ERP — Migration 0010: Project Documentation Center
-- Creates document_category enum, project_documents table, storage bucket,
-- and RLS policies on both table and storage.objects.
-- =============================================================================

-- 1. Create document_category Enum
DO $$ BEGIN
  CREATE TYPE document_category AS ENUM ('drawing', 'contract', 'report', 'photo', 'other');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Create Table project_documents
CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL CHECK (file_size > 0),
  category document_category NOT NULL DEFAULT 'other',
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.project_documents IS 'Stores project document metadata and storage bucket paths.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_documents_project ON public.project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_category ON public.project_documents(category);

-- 3. Enable Table RLS
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- Table RLS Policies
DROP POLICY IF EXISTS "project_documents_select" ON public.project_documents;
DROP POLICY IF EXISTS "project_documents_insert" ON public.project_documents;
DROP POLICY IF EXISTS "project_documents_delete" ON public.project_documents;

CREATE POLICY "project_documents_select" ON public.project_documents FOR SELECT USING (
  auth.role() = 'authenticated'
);

CREATE POLICY "project_documents_insert" ON public.project_documents FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
);

CREATE POLICY "project_documents_delete" ON public.project_documents FOR DELETE USING (
  uploaded_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

-- 4. Create Storage Bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-documents', 'project-documents', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- 5. Storage RLS Policies on storage.objects for project-documents bucket
DROP POLICY IF EXISTS "storage_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "storage_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "storage_documents_delete" ON storage.objects;

-- SELECT (signed URL access for authenticated users)
CREATE POLICY "storage_documents_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'project-documents' AND
  auth.role() = 'authenticated'
);

-- INSERT (upload files)
CREATE POLICY "storage_documents_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'project-documents' AND
  auth.role() = 'authenticated'
);

-- DELETE (delete files: owner or admin/project_manager)
CREATE POLICY "storage_documents_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'project-documents' AND (
    owner = auth.uid() OR
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
  )
);
