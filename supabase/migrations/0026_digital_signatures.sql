-- =============================================================================
-- Nirmaan ERP — Migration 0026: Digital Signature Acknowledgments (Append-Only Audit Log)
-- =============================================================================

-- 1. Create public.signature_acknowledgments table
CREATE TABLE IF NOT EXISTS public.signature_acknowledgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type TEXT NOT NULL, -- e.g. 'tender_award', 'client_milestone', 'leave_approval'
  reference_id UUID NOT NULL, -- ID of the tender, project, or leave request
  signed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  typed_name TEXT NOT NULL,
  ip_address TEXT DEFAULT NULL,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit lookups
CREATE INDEX IF NOT EXISTS idx_sig_ack_reference ON public.signature_acknowledgments(action_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_sig_ack_signed_by ON public.signature_acknowledgments(signed_by);

-- 2. Row Level Security Policies (Append-Only Audit Table)
ALTER TABLE public.signature_acknowledgments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sig_ack_select" ON public.signature_acknowledgments;
DROP POLICY IF EXISTS "sig_ack_insert" ON public.signature_acknowledgments;

-- SELECT Policy: Signer or Admin / PM can view signature audit records
CREATE POLICY "sig_ack_select" ON public.signature_acknowledgments
FOR SELECT USING (
  signed_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.users
     WHERE id = auth.uid()
       AND role IN ('admin', 'project_manager')
  )
);

-- INSERT Policy: Only authenticated user matching signed_by can insert
CREATE POLICY "sig_ack_insert" ON public.signature_acknowledgments
FOR INSERT WITH CHECK (
  signed_by = auth.uid()
);

-- NOTE: NO UPDATE or DELETE policies are defined.
-- signature_acknowledgments is an immutable, append-only audit trail.

-- 3. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
