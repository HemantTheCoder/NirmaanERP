-- Document versioning + AI diffing: adds a self-referential "supersedes"
-- link so an upload can point at the document it replaces, plus columns
-- to hold the AI-generated "what changed" result.
--
-- Also adds the UPDATE policy on project_documents, which was missing
-- entirely — RLS defaults to deny, so without this the diff route could
-- never write diff_status/diff_summary back regardless of how correct
-- the rest of it was. Verified live: an admin/PM write now succeeds, a
-- non-owner non-manager write still correctly no-ops under RLS.

DO $$ BEGIN
  CREATE TYPE public.document_diff_status AS ENUM ('pending', 'complete', 'failed');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS supersedes_document_id UUID NULL
    REFERENCES public.project_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS diff_summary TEXT NULL,
  ADD COLUMN IF NOT EXISTS diff_status public.document_diff_status NULL;

CREATE INDEX IF NOT EXISTS idx_project_documents_supersedes
  ON public.project_documents(supersedes_document_id);

DROP POLICY IF EXISTS "project_documents_update" ON public.project_documents;
CREATE POLICY "project_documents_update" ON public.project_documents FOR UPDATE USING (
  uploaded_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
) WITH CHECK (
  uploaded_by = auth.uid() OR
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'project_manager'))
);

NOTIFY pgrst, 'reload schema';
