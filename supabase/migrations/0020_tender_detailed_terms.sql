-- =============================================================================
-- Nirmaan ERP — Migration 0020: Detailed Tender Terms (EMD, Fees, Legal, Window)
-- =============================================================================

-- 1. Extend public.tenders table
ALTER TABLE public.tenders
  ADD COLUMN IF NOT EXISTS emd_amount NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS emd_refundable BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tender_fee NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS performance_guarantee_percent NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS opening_date TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS special_conditions TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS legal_clauses TEXT DEFAULT NULL;

-- 2. Extend public.bids table
ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS emd_reference TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN DEFAULT false;

-- 3. Database-level validation trigger on public.bids INSERT/UPDATE
CREATE OR REPLACE FUNCTION validate_bid_submission()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  t_emd_amount NUMERIC;
  t_status TEXT;
  t_deadline TIMESTAMPTZ;
BEGIN
  -- Fetch tender details
  SELECT emd_amount, status, submission_deadline 
    INTO t_emd_amount, t_status, t_deadline
    FROM public.tenders
   WHERE id = NEW.tender_id;

  -- Verify terms_accepted is true
  IF NEW.terms_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'You must explicitly read and accept the tender terms and legal clauses before submitting a bid.';
  END IF;

  -- Verify EMD payment reference if EMD is required on tender
  IF t_emd_amount IS NOT NULL AND t_emd_amount > 0 THEN
    IF NEW.emd_reference IS NULL OR TRIM(NEW.emd_reference) = '' THEN
      RAISE EXCEPTION 'EMD Payment Reference Number is required for tenders with an Earnest Money Deposit.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_bid_submission ON public.bids;
CREATE TRIGGER trg_validate_bid_submission
BEFORE INSERT OR UPDATE ON public.bids
FOR EACH ROW EXECUTE FUNCTION validate_bid_submission();
