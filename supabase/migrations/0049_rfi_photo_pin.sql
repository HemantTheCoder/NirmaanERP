-- =============================================================================
-- Nirmaan ERP — Migration 0049: RFI Photo Pin (location markup)
-- =============================================================================
-- Lets an RFI reference an exact spot on a site photo instead of only
-- describing the location in text — reuses the same pin-shape format and
-- storage bucket already built for punch_items.annotation_data (see
-- 0029_punch_photos_bucket.sql, components/projects/PunchItemAnnotator.tsx).
-- Full drawing/PDF markup would need a PDF-rasterizing viewer (pdf.js) and
-- is deliberately out of scope here — this covers photos only.

ALTER TABLE public.rfis
  ADD COLUMN IF NOT EXISTS photo_path TEXT,
  ADD COLUMN IF NOT EXISTS pin_data JSONB;

COMMENT ON COLUMN public.rfis.photo_path IS
  'Optional site photo this RFI references (punch-photos bucket); pin_data marks the exact spot on it.';
COMMENT ON COLUMN public.rfis.pin_data IS
  'A single {type:"pin", x, y} shape (0.0-1.0 relative coords, same format as punch_items.annotation_data) marking the location on photo_path.';

NOTIFY pgrst, 'reload schema';
