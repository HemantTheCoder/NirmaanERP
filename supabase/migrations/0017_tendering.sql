-- =============================================================================
-- Nirmaan ERP — Migration 0017: Tendering Schema, Tables & RLS Policies
-- Creates tender_status & bid_status enums, tenders, bids, tender_documents,
-- 'tender-documents' storage bucket, and role-conditional RLS policies.
-- =============================================================================

-- ── 1. Enums ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE tender_status AS ENUM ('draft', 'published', 'closed', 'awarded', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE bid_status AS ENUM ('submitted', 'under_review', 'shortlisted', 'awarded', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 2. Tables ────────────────────────────────────────────────────────────────

-- Table: tenders
CREATE TABLE IF NOT EXISTS public.tenders (
  id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID            REFERENCES public.projects(id) ON DELETE SET NULL,
  title                   TEXT            NOT NULL,
  category                TEXT            NOT NULL DEFAULT 'civil',
  scope_description       TEXT,
  eligibility_criteria    TEXT,
  estimated_value_min     NUMERIC(15, 2),
  estimated_value_max     NUMERIC(15, 2),
  submission_deadline     TIMESTAMPTZ     NOT NULL,
  status                  tender_status   NOT NULL DEFAULT 'draft',
  created_by              UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  awarded_bid_id          UUID,           -- FK added below after bids table
  created_at              TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Table: bids
CREATE TABLE IF NOT EXISTS public.bids (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id       UUID            NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  contractor_id   UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bid_amount      NUMERIC(15, 2)  NOT NULL,
  proposal_text   TEXT,
  status          bid_status      NOT NULL DEFAULT 'submitted',
  submitted_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  reviewed_by     UUID            REFERENCES public.users(id) ON DELETE SET NULL,
  review_notes    TEXT,
  CONSTRAINT unique_contractor_tender_bid UNIQUE (tender_id, contractor_id)
);

-- Foreign Key: tenders.awarded_bid_id -> bids.id
ALTER TABLE public.tenders
  DROP CONSTRAINT IF EXISTS fk_tenders_awarded_bid;

ALTER TABLE public.tenders
  ADD CONSTRAINT fk_tenders_awarded_bid
  FOREIGN KEY (awarded_bid_id)
  REFERENCES public.bids(id)
  ON DELETE SET NULL;

-- Table: tender_documents
CREATE TABLE IF NOT EXISTS public.tender_documents (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  tender_id       UUID            NOT NULL REFERENCES public.tenders(id) ON DELETE CASCADE,
  file_name       TEXT            NOT NULL,
  file_path       TEXT            NOT NULL,
  file_type       TEXT            NOT NULL,
  file_size       BIGINT          NOT NULL,
  uploaded_by     UUID            NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenders_status          ON public.tenders(status);
CREATE INDEX IF NOT EXISTS idx_tenders_project_id      ON public.tenders(project_id);
CREATE INDEX IF NOT EXISTS idx_tenders_created_by      ON public.tenders(created_by);
CREATE INDEX IF NOT EXISTS idx_bids_tender_id          ON public.bids(tender_id);
CREATE INDEX IF NOT EXISTS idx_bids_contractor_id      ON public.bids(contractor_id);
CREATE INDEX IF NOT EXISTS idx_bids_status             ON public.bids(status);
CREATE INDEX IF NOT EXISTS idx_tender_docs_tender_id   ON public.tender_documents(tender_id);

-- ── 3. Storage Bucket: tender-documents ─────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('tender-documents', 'tender-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DROP POLICY IF EXISTS "tender_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "tender_documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "tender_documents_storage_delete" ON storage.objects;

CREATE POLICY "tender_documents_storage_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'tender-documents'
  AND (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'project_manager')
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'contractor'
    )
  )
);

CREATE POLICY "tender_documents_storage_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'tender-documents'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);

CREATE POLICY "tender_documents_storage_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'tender-documents'
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);

-- ── 4. Row Level Security Policies ──────────────────────────────────────────

-- Table: public.tenders
ALTER TABLE public.tenders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenders_select" ON public.tenders;
DROP POLICY IF EXISTS "tenders_insert" ON public.tenders;
DROP POLICY IF EXISTS "tenders_update" ON public.tenders;
DROP POLICY IF EXISTS "tenders_delete" ON public.tenders;

CREATE POLICY "tenders_select" ON public.tenders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'contractor'
    )
    AND status IN ('published', 'closed', 'awarded')
  )
);

CREATE POLICY "tenders_insert" ON public.tenders FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);

CREATE POLICY "tenders_update" ON public.tenders FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);

CREATE POLICY "tenders_delete" ON public.tenders FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- Table: public.bids
ALTER TABLE public.bids ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bids_select" ON public.bids;
DROP POLICY IF EXISTS "bids_insert" ON public.bids;
DROP POLICY IF EXISTS "bids_update" ON public.bids;
DROP POLICY IF EXISTS "bids_delete" ON public.bids;

CREATE POLICY "bids_select" ON public.bids FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'contractor'
    )
    AND contractor_id = auth.uid()
  )
);

CREATE POLICY "bids_insert" ON public.bids FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'contractor'
  )
  AND contractor_id = auth.uid()
  AND status = 'submitted'
  AND EXISTS (
    SELECT 1 FROM public.tenders
    WHERE id = tender_id
      AND status = 'published'
      AND submission_deadline > now()
  )
);

CREATE POLICY "bids_update" ON public.bids FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);

CREATE POLICY "bids_delete" ON public.bids FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  )
);

-- Table: public.tender_documents
ALTER TABLE public.tender_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tender_documents_select" ON public.tender_documents;
DROP POLICY IF EXISTS "tender_documents_insert" ON public.tender_documents;
DROP POLICY IF EXISTS "tender_documents_delete" ON public.tender_documents;

CREATE POLICY "tender_documents_select" ON public.tender_documents FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
  OR
  (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role = 'contractor'
    )
    AND EXISTS (
      SELECT 1 FROM public.tenders
      WHERE id = tender_documents.tender_id
        AND status IN ('published', 'closed', 'awarded')
    )
  )
);

CREATE POLICY "tender_documents_insert" ON public.tender_documents FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);

CREATE POLICY "tender_documents_delete" ON public.tender_documents FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IN ('admin', 'project_manager')
  )
);
